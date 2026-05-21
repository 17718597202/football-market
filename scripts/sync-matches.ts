/**
 * 同步赛程脚本（可独立执行 / 作为定时任务）
 * 用法：
 *   npm run sync:matches -- PL 2026-05-20 2026-05-27 --auto
 *   参数：联赛代码 起始日期 结束日期 [--auto 自动建胜平负市场]
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import {
  listMatches,
  mapStatus,
  winnerToKey,
  type CompetitionCode,
} from '../lib/football-data';
import { translateTeam, translateCompetition } from '../lib/translation';
import { injectMarketLiquidity } from '../lib/liquidity-engine';

async function run() {
  const args = process.argv.slice(2);
  const autoCreate = args.includes('--auto');
  
  const positional = args.filter(a => !a.startsWith('--'));
  const comp = positional[0] || 'PL';
  let from = positional[1];
  let to = positional[2];

  if (!from || !to) {
    const today = new Date();
    const future = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
    from = today.toISOString().split('T')[0];
    to = future.toISOString().split('T')[0];
  }

  console.log(`[sync] ${comp} ${from} - ${to} autoCreate=${autoCreate}`);

  const matches = await listMatches(comp as CompetitionCode, {
    dateFrom: from,
    dateTo: to,
  });
  console.log(`[sync] 拉取到 ${matches.length} 场`);

  const existingMatches = await prisma.match.findMany({
    where: { externalId: { in: matches.map((m) => String(m.id)) } },
    select: { id: true, externalId: true },
  });
  const existingMap = new Map(existingMatches.map((m) => [m.externalId, m]));

  let created = 0,
    updated = 0,
    marketsCreated = 0;
  for (const m of matches) {
    const status = mapStatus(m.status);
    const finalResult =
      status === 'FINISHED' ? winnerToKey(m.score?.winner ?? null) : null;

    const homeTeamZh = translateTeam(m.homeTeam.shortName || m.homeTeam.name);
    const awayTeamZh = translateTeam(m.awayTeam.shortName || m.awayTeam.name);
    const competitionZh = translateCompetition(m.competition.name);

    const data = {
      externalId: String(m.id),
      competition: competitionZh,
      homeTeam: homeTeamZh,
      awayTeam: awayTeamZh,
      homeLogo: m.homeTeam.crest,
      awayLogo: m.awayTeam.crest,
      kickoffAt: new Date(m.utcDate),
      status,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      finalResult,
    };
    const existing = existingMap.get(String(m.id));
    let match;
    if (existing) {
      match = await prisma.match.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      match = await prisma.match.create({ data });
      created++;
    }

    if (autoCreate && status === 'SCHEDULED') {
      const [exist1x2, existCs] = await Promise.all([
        prisma.market.findFirst({
          where: { matchId: match.id, type: 'RESULT_1X2' },
          select: { id: true },
        }),
        prisma.market.findFirst({
          where: { matchId: match.id, type: 'CORRECT_SCORE' },
          select: { id: true },
        }),
      ]);

      const marketPromises = [];

      // 1. 胜平负市场
      if (!exist1x2) {
        marketPromises.push(
          (async () => {
            const m1 = await prisma.market.create({
              data: {
                matchId: match.id,
                type: 'RESULT_1X2',
                title: `${match.homeTeam} vs ${match.awayTeam} - 全场胜平负`,
                lockAt: match.kickoffAt,
                rakeBps: Number(process.env.PLATFORM_RAKE_BPS || 300),
                options: {
                  create: [
                    { key: 'HOME', label: `${match.homeTeam} 胜` },
                    { key: 'DRAW', label: '平局' },
                    { key: 'AWAY', label: `${match.awayTeam} 胜` },
                  ],
                },
              },
            });
            await injectMarketLiquidity(m1.id);
            marketsCreated++;
          })()
        );
      }

      // 2. 比分波胆市场
      if (!existCs) {
        marketPromises.push(
          (async () => {
            const correctScoreOptions = [
              // 主胜
              { key: '1:0', label: '1 - 0' },
              { key: '2:0', label: '2 - 0' },
              { key: '2:1', label: '2 - 1' },
              { key: '3:0', label: '3 - 0' },
              { key: '3:1', label: '3 - 1' },
              { key: '3:2', label: '3 - 2' },
              // 平局
              { key: '0:0', label: '0 - 0' },
              { key: '1:1', label: '1 - 1' },
              { key: '2:2', label: '2 - 2' },
              { key: '3:3', label: '3 - 3' },
              // 客胜
              { key: '0:1', label: '0 - 1' },
              { key: '0:2', label: '0 - 2' },
              { key: '1:2', label: '1 - 2' },
              { key: '0:3', label: '0 - 3' },
              { key: '1:3', label: '1 - 3' },
              { key: '2:3', label: '2 - 3' },
              // 其他
              { key: 'OTHER', label: '其他比分' },
            ];

            const m2 = await prisma.market.create({
              data: {
                matchId: match.id,
                type: 'CORRECT_SCORE',
                title: `${match.homeTeam} vs ${match.awayTeam} - 全场比分波胆`,
                lockAt: match.kickoffAt,
                rakeBps: Number(process.env.PLATFORM_RAKE_BPS || 300),
                options: {
                  create: correctScoreOptions,
                },
              },
            });
            await injectMarketLiquidity(m2.id);
            marketsCreated++;
          })()
        );
      }

      if (marketPromises.length > 0) {
        await Promise.all(marketPromises);
      }
    }
  }

  console.log(
    `[sync] 完成：新增 ${created} 更新 ${updated} 自动建市场 ${marketsCreated}`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const loop = args.includes('--loop');
  if (!loop) {
    await run();
    process.exit(0);
  }
  console.log('[sync] 常驻模式，每 60 分钟跑一次');
  while (true) {
    try {
      await run();
    } catch (e) {
      console.error('[sync] run 出错:', e);
    }
    await new Promise((r) => setTimeout(r, 60 * 60 * 1000));
  }
}

main();
