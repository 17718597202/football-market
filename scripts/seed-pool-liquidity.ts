/**
 * 彩池流动性初始化脚本 (Pari-mutuel Cold Start Seeder)
 * 运行：npx tsx scripts/seed-pool-liquidity.ts
 */
import { prisma } from '../lib/db';
import { add } from '../lib/money';

async function seedLiquidity() {
  console.log('[liquidity] 开始为所有预测彩池注入初始流动性，解决冷启动赔率显示问题...');

  const markets = await prisma.market.findMany({
    include: { options: true },
  });

  if (markets.length === 0) {
    console.warn('[liquidity] ⚠️ 数据库中没有市场，请先运行 npx tsx scripts/offline-seed.ts');
    return;
  }

  let totalInjected = 0;

  for (const m of markets) {
    console.log(`[liquidity] 正在初始化彩池: ${m.title}`);

    // 生成随机的总初始流动性（2000 U - 8000 U 之间）
    const targetTotal = Math.floor(Math.random() * 6000) + 2000;
    let distributedStake = 0;

    if (m.type === 'RESULT_1X2') {
      // 模拟胜平负的高仿真比例 (例如：主胜 48%, 平局 24%, 客胜 28%)
      const ratios: Record<string, number> = {
        HOME: 0.45 + Math.random() * 0.1, // 45% - 55%
        DRAW: 0.20 + Math.random() * 0.08, // 20% - 28%
        AWAY: 0.22 + Math.random() * 0.08, // 22% - 30%
      };

      // 归一化比例
      const sum = ratios.HOME + ratios.DRAW + ratios.AWAY;
      ratios.HOME /= sum;
      ratios.DRAW /= sum;
      ratios.AWAY /= sum;

      for (const opt of m.options) {
        const share = ratios[opt.key] || 0.33;
        const stake = Math.floor(targetTotal * share);
        distributedStake += stake;

        await prisma.marketOption.update({
          where: { id: opt.id },
          data: {
            totalStake: String(stake),
            betCount: Math.floor(stake / (15 + Math.random() * 30)) + 3, // 模拟投注人数
          },
        });
      }
    } else if (m.type === 'CORRECT_SCORE') {
      // 模拟波胆比分分布：低比分高投注，高比分极低投注，OTHER中等投注
      const csRatios: Record<string, number> = {
        // 主胜
        '1:0': 0.12,
        '2:0': 0.10,
        '2:1': 0.14,
        '3:0': 0.04,
        '3:1': 0.05,
        '3:2': 0.02,
        // 平局
        '0:0': 0.08,
        '1:1': 0.15,
        '2:2': 0.06,
        '3:3': 0.01,
        // 客胜
        '0:1': 0.09,
        '0:2': 0.04,
        '1:2': 0.06,
        '0:3': 0.01,
        '1:3': 0.01,
        '2:3': 0.01,
        // 其他
        'OTHER': 0.01,
      };

      // 随机微调比例，使每场比赛的波胆赔率各不相同且逼真
      let sum = 0;
      const adjustedRatios: Record<string, number> = {};
      for (const key of Object.keys(csRatios)) {
        const randFactor = 0.8 + Math.random() * 0.4; // 80% - 120% 的随机微调
        adjustedRatios[key] = csRatios[key] * randFactor;
        sum += adjustedRatios[key];
      }

      // 归一化并更新选项
      for (const opt of m.options) {
        const share = (adjustedRatios[opt.key] || 0.01) / sum;
        const stake = Math.max(Math.floor(targetTotal * share), 10); // 确保每个选项至少有 10 U
        distributedStake += stake;

        await prisma.marketOption.update({
          where: { id: opt.id },
          data: {
            totalStake: String(stake),
            betCount: Math.floor(stake / (10 + Math.random() * 20)) + 1,
          },
        });
      }
    }

    // 更新市场总池额
    await prisma.market.update({
      where: { id: m.id },
      data: { totalStake: String(distributedStake) },
    });

    totalInjected += distributedStake;
    console.log(`[liquidity] ✓ 已为该彩池注入 ${distributedStake} U 的种子资金`);
  }

  console.log(`\n[liquidity] 🎉 流动性注入完毕！累计注入：${totalInjected} U`);
  console.log('[liquidity] 现在打开前台，所有赛事都已自动显示极具吸引力的实时高保真赔率！');
}

seedLiquidity()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[liquidity] ❌ 流动性注入失败:', e);
    process.exit(1);
  });
