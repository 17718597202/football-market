/**
 * 垃圾数据清理脚本：重置数据库至纯净状态
 * 运行：npx tsx scripts/cleanup.ts
 */
import { prisma } from '../lib/db';

async function clean() {
  console.log('[cleanup] 开始清理测试与垃圾数据...');

  // 1. 清空所有交易与账目流水
  await prisma.transaction.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.deposit.deleteMany();
  console.log('[cleanup] ✓ 已清空所有流水、充值、提现记录');

  // 2. 清空所有下注记录
  await prisma.bet.deleteMany();
  console.log('[cleanup] ✓ 已清空所有用户下注数据');

  // 3. 清空所有市场选项与预测市场
  await prisma.marketOption.deleteMany();
  await prisma.market.deleteMany();
  console.log('[cleanup] ✓ 已清空所有预测市场与投注选项');

  // 4. 清空所有比赛场次
  await prisma.match.deleteMany();
  console.log('[cleanup] ✓ 已清空所有模拟与测试的比赛数据');

  // 5. 重置测试用户的额度为 1000 U 体验金，重置 admin 余额
  await prisma.user.updateMany({
    where: { role: 'USER' },
    data: { balanceUsdt: '1000', frozenUsdt: '0' },
  });
  await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { balanceUsdt: '0', frozenUsdt: '0' },
  });
  console.log('[cleanup] ✓ 已重置所有测试账号 (alice/bob/carol) 余额为 1000.00 U');

  console.log('[cleanup] 🎉 垃圾数据清理完毕，数据库已完全恢复纯净！');
}

clean()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[cleanup] ❌ 清理过程中发生错误:', e);
    process.exit(1);
  });
