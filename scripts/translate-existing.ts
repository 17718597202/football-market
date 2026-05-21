/**
 * 翻译数据库中已有的英文比赛和市场数据
 * 运行：npx tsx scripts/translate-existing.ts
 */
import { prisma } from '../lib/db';
import { translateTeam, translateCompetition } from '../lib/translation';

async function run() {
  console.log('[translate] 开始翻译数据库中已有的英文数据...');

  // 1. 翻译 Match 记录
  const matches = await prisma.match.findMany();
  for (const m of matches) {
    const homeZh = translateTeam(m.homeTeam);
    const awayZh = translateTeam(m.awayTeam);
    const compZh = translateCompetition(m.competition);

    await prisma.match.update({
      where: { id: m.id },
      data: {
        homeTeam: homeZh,
        awayTeam: awayZh,
        competition: compZh,
      },
    });
  }
  console.log(`[translate] ✓ 成功翻译了 ${matches.length} 场比赛的名词`);

  // 2. 重新加载并更新 Market 标题和 Option 选项
  const markets = await prisma.market.findMany({
    include: { match: true, options: true },
  });

  for (const m of markets) {
    if (m.type === 'RESULT_1X2') {
      const newTitle = `${m.match.homeTeam} vs ${m.match.awayTeam} - 全场胜平负`;
      await prisma.market.update({
        where: { id: m.id },
        data: { title: newTitle },
      });

      for (const opt of m.options) {
        let newLabel = opt.label;
        if (opt.key === 'HOME') newLabel = `${m.match.homeTeam} 胜`;
        if (opt.key === 'AWAY') newLabel = `${m.match.awayTeam} 胜`;
        if (opt.key === 'DRAW') newLabel = '平局';

        await prisma.marketOption.update({
          where: { id: opt.id },
          data: { label: newLabel },
        });
      }
    }
  }
  console.log(`[translate] ✓ 成功重置并翻译了 ${markets.length} 个市场的中文标题与选项`);
}

run()
  .then(() => {
    console.log('[translate] 数据库汉化全部完成！');
    process.exit(0);
  })
  .catch((e) => {
    console.error('[translate] 汉化脚本运行出错:', e);
    process.exit(1);
  });
