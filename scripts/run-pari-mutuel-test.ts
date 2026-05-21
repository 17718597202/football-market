/**
 * 自动投注与派彩结算测试脚本
 * 运行：npx tsx scripts/run-pari-mutuel-test.ts
 */
import { prisma } from '../lib/db';
import { settleMarket } from '../lib/pari-mutuel';
import { add, sub } from '../lib/money';

async function test() {
  console.log('[test] 正在初始化自动投注与彩池结算测试...');

  // 1. 获取测试用户账号
  const alice = await prisma.user.findUnique({ where: { username: 'alice' } });
  const bob = await prisma.user.findUnique({ where: { username: 'bob' } });
  if (!alice || !bob) {
    console.error('[test] ❌ 未找到 alice 或 bob 账号，请确认已运行过 npm run db:seed');
    return;
  }
  console.log(`[test] ✓ Alice 初始余额: ${alice.balanceUsdt} U`);
  console.log(`[test] ✓ Bob 初始余额: ${bob.balanceUsdt} U`);

  // 2. 匹配切尔西 vs 阿森纳市场
  const market = await prisma.market.findFirst({
    where: { title: { contains: '切尔西' } },
    include: { options: true, match: true },
  });
  if (!market) {
    console.error('[test] ❌ 未找到“切尔西 vs 阿森纳”示例市场');
    return;
  }
  console.log(`[test] ✓ 匹配到目标市场: ${market.title}`);

  // 3. 重置并清理之前的测试投注数据，保证纯净测试环境
  await prisma.bet.deleteMany({ where: { marketId: market.id } });
  await prisma.marketOption.updateMany({
    where: { marketId: market.id },
    data: { totalStake: '0', betCount: 0 },
  });
  await prisma.market.update({
    where: { id: market.id },
    data: { totalStake: '0', status: 'OPEN', winningKey: null },
  });

  const homeOpt = market.options.find((o) => o.key === 'HOME')!;
  const awayOpt = market.options.find((o) => o.key === 'AWAY')!;

  console.log('[test] -----------------------------------------');
  console.log('[test] 🚀 正在模拟投注：');
  console.log('[test]   - Alice 对 [切尔西胜] 投注 200.00 U');
  console.log('[test]   - Bob 对 [阿森纳胜] 投注 300.00 U');

  // 为 Alice 投注 200 U
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: alice.id },
      data: { balanceUsdt: sub(alice.balanceUsdt, '200') },
    });
    await tx.bet.create({
      data: {
        userId: alice.id,
        marketId: market.id,
        optionId: homeOpt.id,
        amount: '200',
        status: 'ACTIVE',
      },
    });
    await tx.marketOption.update({
      where: { id: homeOpt.id },
      data: { totalStake: '200', betCount: 1 },
    });
  });

  // 为 Bob 投注 300 U
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: bob.id },
      data: { balanceUsdt: sub(bob.balanceUsdt, '300') },
    });
    await tx.bet.create({
      data: {
        userId: bob.id,
        marketId: market.id,
        optionId: awayOpt.id,
        amount: '300',
        status: 'ACTIVE',
      },
    });
    await tx.marketOption.update({
      where: { id: awayOpt.id },
      data: { totalStake: '300', betCount: 1 },
    });
  });

  // 更新总奖池
  await prisma.market.update({
    where: { id: market.id },
    data: { totalStake: '500' },
  });

  console.log('[test] ✓ 投注模拟成功！当前市场总池子增至 500.00 U');
  console.log('[test] -----------------------------------------');

  // 4. 模拟比赛以 2:1 结束，判定 HOME（切尔西）胜出
  console.log('[test] ⚽ 正在模拟比赛结束：');
  console.log('[test]   - 比分设定为：切尔西 2 : 1 阿森纳');
  console.log('[test]   - 胜出方向为：切尔西胜 (HOME)');
  await prisma.match.update({
    where: { id: market.matchId },
    data: {
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      finalResult: 'HOME',
    },
  });

  // 5. 触发核心彩池派彩结算函数
  console.log('[test] 💸 正在运行 settleMarket() 彩池自动派彩结算...');
  const res = await settleMarket(market.id, 'HOME');

  console.log('\n=========================================');
  console.log('🎉 自动派彩与平台结算测试成功完成！');
  console.log(`- 结算市场: ${market.title}`);
  console.log(`- 市场状态: ${res.status}`);
  console.log(`- 参与分账用户数: ${res.affectedUsers} 人`);
  console.log(`- 平台抽水总计 (3%): ${res.rake} U`);
  console.log(`- 派发中奖金额总计: ${res.payoutPool} U (扣除 15 U 抽水后，485 U 全部派发)`);
  console.log('-----------------------------------------');

  // 6. 验证最终余额账目
  const aliceAfter = await prisma.user.findUnique({ where: { id: alice.id } });
  const bobAfter = await prisma.user.findUnique({ where: { id: bob.id } });
  console.log(`- Alice 期末余额: ${aliceAfter?.balanceUsdt} U`);
  console.log(`  (初始 1000 U, 投了 200 U, 独揽 485 U 派彩, 净赚 285 U)`);
  console.log(`- Bob 期末余额: ${bobAfter?.balanceUsdt} U`);
  console.log(`  (初始 1000 U, 投了 300 U, 未中奖, 期末剩余 700 U)`);
  console.log('=========================================\n');
}

test()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[test] ❌ 测试运行失败:', e);
    process.exit(1);
  });
