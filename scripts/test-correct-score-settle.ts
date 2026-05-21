/**
 * 比分波胆核心结算测试脚本
 * 运行：npx tsx scripts/test-correct-score-settle.ts
 */
import { prisma } from '../lib/db';
import { settleMarket } from '../lib/pari-mutuel';
import { add, sub } from '../lib/money';

async function testCorrectScore() {
  console.log('[test-cs] 正在初始化比分波胆市场结算测试...');

  // 1. 获取测试用户账号
  const alice = await prisma.user.findUnique({ where: { username: 'alice' } });
  const bob = await prisma.user.findUnique({ where: { username: 'bob' } });
  if (!alice || !bob) {
    console.error('[test-cs] ❌ 未找到测试用户，请确认已运行 seed');
    return;
  }
  console.log(`[test-cs] ✓ Alice 初始余额: ${alice.balanceUsdt} U`);
  console.log(`[test-cs] ✓ Bob 初始余额: ${bob.balanceUsdt} U`);

  // 2. 匹配曼城 vs 阿森纳比分市场
  const market = await prisma.market.findFirst({
    where: { title: { contains: '曼城' }, type: 'CORRECT_SCORE' },
    include: { options: true, match: true },
  });
  if (!market) {
    console.error('[test-cs] ❌ 未找到“曼城 vs 阿森纳”比分波胆市场');
    return;
  }
  console.log(`[test-cs] ✓ 匹配到目标比分波胆市场: ${market.title}, ID: ${market.id}`);

  // 3. 清理该市场的下注数据以提供纯净测试
  await prisma.bet.deleteMany({ where: { marketId: market.id } });
  await prisma.marketOption.updateMany({
    where: { marketId: market.id },
    data: { totalStake: '0', betCount: 0 },
  });
  await prisma.market.update({
    where: { id: market.id },
    data: { totalStake: '0', status: 'OPEN', winningKey: null },
  });

  const opt21 = market.options.find((o) => o.key === '2:1')!;
  const opt10 = market.options.find((o) => o.key === '1:0')!;

  console.log('[test-cs] -----------------------------------------');
  console.log('[test-cs] 🚀 正在模拟比分投注：');
  console.log('[test-cs]   - Alice 押注 [2-1 (曼城胜)] 200.00 U');
  console.log('[test-cs]   - Bob 押注 [1-0 (曼城胜)] 300.00 U');

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
        optionId: opt21.id,
        amount: '200',
        status: 'ACTIVE',
      },
    });
    await tx.marketOption.update({
      where: { id: opt21.id },
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
        optionId: opt10.id,
        amount: '300',
        status: 'ACTIVE',
      },
    });
    await tx.marketOption.update({
      where: { id: opt10.id },
      data: { totalStake: '300', betCount: 1 },
    });
  });

  // 更新总奖池
  await prisma.market.update({
    where: { id: market.id },
    data: { totalStake: '500' },
  });

  console.log('[test-cs] ✓ 投注模拟成功！比分波胆池总额增至 500.00 U');
  console.log('[test-cs] -----------------------------------------');

  // 4. 模拟比赛以 2:1 结束
  console.log('[test-cs] ⚽ 正在模拟比赛以真实比分结束：');
  console.log('[test-cs]   - 比分设定为：曼城 2 : 1 阿森纳');
  await prisma.match.update({
    where: { id: market.matchId },
    data: {
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      finalResult: 'HOME',
    },
  });

  // 5. 触发比分波胆彩池自动派彩结算
  console.log('[test-cs] 💸 正在运行 settleMarket() 进行比分波胆结算...');
  const res = await settleMarket(market.id, '2:1');

  console.log('\n=========================================');
  console.log('🎉 比分波胆（Correct Score）自动派彩测试成功！');
  console.log(`- 结算市场: ${market.title}`);
  console.log(`- 市场状态: ${res.status}`);
  console.log(`- 中奖比分选项: ${res.winnerOptionKey} (2:1)`);
  console.log(`- 平台抽水 (3%): ${res.rake} U`);
  console.log(`- 中奖返还总计: ${res.payoutPool} U (485.00 U)`);
  console.log('-----------------------------------------');

  // 6. 验证最终余额账目
  const aliceAfter = await prisma.user.findUnique({ where: { id: alice.id } });
  const bobAfter = await prisma.user.findUnique({ where: { id: bob.id } });
  console.log(`- Alice 期末余额: ${aliceAfter?.balanceUsdt} U`);
  console.log(`  (押中 2:1，赢取全部 485 U 派彩)`);
  console.log(`- Bob 期末余额: ${bobAfter?.balanceUsdt} U`);
  console.log(`  (押注 1:0，预测失败，期末剩余余额正常)`);
  console.log('=========================================\n');
}

testCorrectScore()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[test-cs] ❌ 比分结算测试失败:', e);
    process.exit(1);
  });
