/**
 * 自动结算 cron
 * - 找出所有 status=OPEN/LOCKED 且对应比赛已 FINISHED 的市场
 * - 通过 football-data.org 拉取最终比分
 * - 如果数据一致且非平局/胜方明确，自动结算
 * - 不一致或异常的留给管理员人工处理
 *
 * 用法：
 *   npm run settle:cron        # 单次跑
 *   npm run settle:cron -- --loop  # 常驻每 5 分钟跑一次
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { getMatch, mapStatus, winnerToKey } from '../lib/football-data';
import { settleMarket } from '../lib/pari-mutuel';

async function run() {
  const candidates = await prisma.market.findMany({
    where: {
      status: { in: ['OPEN', 'LOCKED'] },
      match: { kickoffAt: { lt: new Date(Date.now() - 90 * 60 * 1000) } },
    },
    include: { match: true, options: true },
  });

  console.log(`[settle] 候选 ${candidates.length} 个市场`);
  const fdCache = new Map<string, any>();
  const updatedMatches = new Set<string>();
  for (const market of candidates) {
    if (!market.match.externalId) {
      console.log(`[settle] 跳过 ${market.id}: 无 externalId（手动创建）`);
      continue;
    }
    try {
      let fd = fdCache.get(market.match.externalId);
      if (!fd) {
        fd = await getMatch(market.match.externalId);
        if (fd) fdCache.set(market.match.externalId, fd);
      }
      if (!fd) {
        console.warn(`[settle] football-data 未返回 ${market.match.externalId}`);
        continue;
      }
      const status = mapStatus(fd.status);
      if (status === 'CANCELLED') {
        console.log(`[settle] 比赛已取消，自动退款并作废市场 ${market.id}`);
        if (!updatedMatches.has(market.matchId)) {
          await prisma.match.update({
            where: { id: market.matchId },
            data: { status: 'CANCELLED' },
          });
          updatedMatches.add(market.matchId);
        }
        const result = await settleMarket(market.id, null, true);
        console.log(`[settle] ✓ ${market.id} 已作废退款，影响=${result.affectedUsers}`);
        continue;
      }
      if (status !== 'FINISHED') {
        console.log(`[settle] ${market.id} 比赛状态 ${status}，跳过`);
        continue;
      }
      // 更新比分到 Match
      if (!updatedMatches.has(market.matchId)) {
        await prisma.match.update({
          where: { id: market.matchId },
          data: {
            status: 'FINISHED',
            homeScore: fd.score?.fullTime?.home ?? null,
            awayScore: fd.score?.fullTime?.away ?? null,
            finalResult: winnerToKey(fd.score?.winner ?? null),
          },
        });
        updatedMatches.add(market.matchId);
      }

      let winningKey: string | null = null;

      if (market.type === 'RESULT_1X2') {
        winningKey = winnerToKey(fd.score?.winner ?? null);
      } else if (market.type === 'CORRECT_SCORE') {
        const hs = fd.score?.fullTime?.home;
        const as = fd.score?.fullTime?.away;
        if (hs !== null && as !== null && hs !== undefined && as !== undefined) {
          const key = `${hs}:${as}`;
          // 检查比分是否为预设的 16 个选项之一，若非，则判定为其他比分 (OTHER)
          const exist = market.options.find((o) => o.key === key);
          winningKey = exist ? key : 'OTHER';
        }
      }

      if (!winningKey) {
        console.warn(`[settle] ${market.id} 无法判定胜出选项，跳过等人工`);
        continue;
      }

      const result = await settleMarket(market.id, winningKey);
      console.log(
        `[settle] ✓ ${market.id} 胜方=${winningKey} 影响=${result.affectedUsers}`
      );
    } catch (e: any) {
      console.error(`[settle] ${market.id} 出错:`, e.message);
    }
  }
}

async function main() {
  const loop = process.argv.includes('--loop');
  if (!loop) {
    await run();
    process.exit(0);
  }
  console.log('[settle] 常驻模式，每 1 分钟跑一次');
  while (true) {
    try {
      await run();
    } catch (e) {
      console.error('[settle] run 出错:', e);
    }
    await new Promise((r) => setTimeout(r, 1 * 60 * 1000));
  }
}

main();
