/**
 * 离线赛程与市场数据生成脚本（避免 API 连线超时）
 * 运行：npx tsx scripts/offline-seed.ts
 */
import { prisma } from '../lib/db';
import { translateTeam, translateCompetition } from '../lib/translation';

async function seedOffline() {
  console.log('[offline-seed] 正在离线生成世界顶级联赛焦点大战数据...');

  // 1. 清理已有赛事和市场
  await prisma.transaction.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.marketOption.deleteMany();
  await prisma.market.deleteMany();
  await prisma.match.deleteMany();

  const now = Date.now();

  // 焦点赛程定义
  const fixtureTemplates = [
    // 英超 (Premier League)
    { comp: 'Premier League', home: 'Manchester City', away: 'Arsenal', offsetHours: 2 },
    { comp: 'Premier League', home: 'Chelsea', away: 'Liverpool', offsetHours: 4 },
    { comp: 'Premier League', home: 'Tottenham Hotspur', away: 'Manchester United', offsetHours: 6 },
    { comp: 'Premier League', home: 'Newcastle United', away: 'Aston Villa', offsetHours: 8 },
    { comp: 'Premier League', home: 'Brighton & Hove Albion', away: 'West Ham United', offsetHours: 12 },

    // 西甲 (La Liga)
    { comp: 'La Liga', home: 'Real Madrid', away: 'Barcelona', offsetHours: 3 },
    { comp: 'La Liga', home: 'Atlético Madrid', away: 'Sevilla', offsetHours: 5 },
    { comp: 'La Liga', home: 'Real Sociedad', away: 'Villarreal', offsetHours: 7 },
    { comp: 'La Liga', home: 'Girona', away: 'Valencia', offsetHours: 9 },

    // 欧冠 (Champions League)
    { comp: 'Champions League', home: 'Paris Saint-Germain', away: 'Bayern Munich', offsetHours: 10 },
  ];

  let matchesCreated = 0;
  let marketsCreated = 0;

  for (const f of fixtureTemplates) {
    const kickoffTime = new Date(now + f.offsetHours * 60 * 60 * 1000);
    const homeZh = translateTeam(f.home);
    const awayZh = translateTeam(f.away);
    const compZh = translateCompetition(f.comp);

    // 1. 创建 Match 记录
    const match = await prisma.match.create({
      data: {
        competition: compZh,
        homeTeam: homeZh,
        awayTeam: awayZh,
        kickoffAt: kickoffTime,
        status: 'SCHEDULED',
      },
    });
    matchesCreated++;

    // 2. 创建 RESULT_1X2（全场胜平负）市场
    await prisma.market.create({
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
    marketsCreated++;

    // 3. 创建 CORRECT_SCORE（全场比分波胆）市场
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

    await prisma.market.create({
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
    marketsCreated++;
  }

  console.log(`[offline-seed] ✓ 成功生成 ${matchesCreated} 场顶级焦点比赛`);
  console.log(`[offline-seed] ✓ 成功自动创建 ${marketsCreated} 个预测玩法市场（含胜平负与波胆）`);
  console.log('[offline-seed] 🎉 离线数据注入与汉化全部完成，平台已完全就绪！');
}

seedOffline()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[offline-seed] ❌ 生成失败:', e);
    process.exit(1);
  });
