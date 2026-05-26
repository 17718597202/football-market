/**
 * 彩池流动性初始化脚本 (Pari-mutuel Cold Start Seeder - Bot Based)
 * 运行：npx tsx scripts/seed-pool-liquidity.ts
 */
import { prisma } from '../lib/db';
import { injectMarketLiquidity } from '../lib/liquidity-engine';

async function seedLiquidity() {
  console.log('[liquidity] 开始为所有预测彩池使用系统机器人注入初始对账一致性流动性...');

  const markets = await prisma.market.findMany({
    select: { id: true, title: true }
  });

  if (markets.length === 0) {
    console.warn('[liquidity] ⚠️ 数据库中没有市场，请先运行 npx tsx scripts/offline-seed.ts');
    return;
  }

  let count = 0;
  for (const m of markets) {
    console.log(`[liquidity] 正在初始化玩法彩池: ${m.title}`);
    try {
      await injectMarketLiquidity(m.id);
      count++;
    } catch (e: any) {
      console.error(`[liquidity] ❌ 彩池 ${m.title} 初始化失败:`, e.message);
    }
  }

  console.log(`\n[liquidity] 🎉 流动性注入完毕！累计成功初始化：${count}/${markets.length} 个玩法彩池`);
}

seedLiquidity()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[liquidity] ❌ 流动性注入失败:', e);
    process.exit(1);
  });
