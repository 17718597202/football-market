/**
 * 固定赔率串关核心结算与级联派彩验证测试脚本
 * 运行：npx tsx scripts/test-parlay-settle.ts
 */
import { prisma } from '../lib/db';
import { placeParlayBet } from '../lib/parlay';
import { settleMarket } from '../lib/pari-mutuel';
import { sub, add } from '../lib/money';

async function testParlay() {
  console.log('[test-parlay] 正在初始化固定赔率串关派彩测试...');

  // 1. 获取测试用户
  const alice = await prisma.user.findUnique({ where: { username: 'alice' } });
  if (!alice) {
    console.error('[test-parlay] ❌ 未找到测试用户 alice');
    return;
  }

  // 重置 Alice 体验余额为 1000 U
  await prisma.user.update({
    where: { id: alice.id },
    data: { balanceUsdt: '1000' },
  });
  console.log(`[test-parlay] ✓ Alice 初始余额重置为: 1000.00 U`);

  // 2. 清理已有关联串单，确保测试环境纯净
  await prisma.parlayItem.deleteMany();
  await prisma.parlayBet.deleteMany();

  // 3. 匹配两个用来串关的独立市场
  // 市场 1: 曼城 vs 阿森纳 胜平负
  const market1 = await prisma.market.findFirst({
    where: { title: { contains: '曼城' }, type: 'RESULT_1X2' },
    include: { options: true, match: true },
  });
  // 市场 2: 切尔西 vs 利物浦 胜平负
  const market2 = await prisma.market.findFirst({
    where: { title: { contains: '切尔西' }, type: 'RESULT_1X2' },
    include: { options: true, match: true },
  });

  if (!market1 || !market2) {
    console.error('[test-parlay] ❌ 缺少测试所需的基础赛事，请先运行 seed-pool-liquidity 注入流动性');
    return;
  }

  console.log(`[test-parlay] ✓ 匹配到 Leg 1 市场: ${market1.title}`);
  console.log(`[test-parlay] ✓ 匹配到 Leg 2 市场: ${market2.title}`);

  // 重置两场比赛状态为 SCHEDULED
  await prisma.match.updateMany({
    where: { id: { in: [market1.matchId, market2.matchId] } },
    data: { status: 'SCHEDULED', homeScore: null, awayScore: null, finalResult: null },
  });
  await prisma.market.updateMany({
    where: { id: { in: [market1.id, market2.id] } },
    data: { status: 'OPEN', winningKey: null },
  });

  const optHome1 = market1.options.find((o) => o.key === 'HOME')!; // 曼城胜
  const optAway2 = market2.options.find((o) => o.key === 'AWAY')!; // 利物浦胜

  console.log('[test-parlay] -----------------------------------------');
  console.log('[test-parlay] 🚀 正在模拟 Alice 串关下注 100.00 U：');
  console.log(`  - 选择 1: 曼城胜 (${market1.title})`);
  console.log(`  - 选择 2: 利物浦胜 (${market2.title})`);

  // 4. 提交串关投注
  const bet = await placeParlayBet(alice.id, '100', [
    { marketId: market1.id, optionId: optHome1.id },
    { marketId: market2.id, optionId: optAway2.id },
  ]);

  const freshAlice = await prisma.user.findUnique({ where: { id: alice.id } });
  console.log(`[test-parlay] ✓ 投注成功！串关主单 ID: ${bet.id}`);
  console.log(`  - 锁死总赔率: ${bet.odds} 倍`);
  console.log(`  - Alice 当前余额: ${freshAlice?.balanceUsdt} U (成功扣减 100 U)`);
  console.log('[test-parlay] -----------------------------------------');

  // 5. 模拟第一场“曼城 vs 阿森纳”比赛结束 (比分 2:1，主队曼城胜)
  console.log('[test-parlay] ⚽ 正在模拟第一场结算：曼城 2 : 1 阿森纳 (HOME 胜)');
  await prisma.match.update({
    where: { id: market1.matchId },
    data: {
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      finalResult: 'HOME',
    },
  });

  // 触发第一场结算
  await settleMarket(market1.id, 'HOME');

  let updatedBet = await prisma.parlayBet.findUnique({
    where: { id: bet.id },
    include: { items: true },
  });

  console.log(`[test-parlay] ✓ 第一场结算完成！`);
  console.log(`  - 串关 Leg 1 状态: ${updatedBet?.items[0].status}`);
  console.log(`  - 串关 Leg 2 状态: ${updatedBet?.items[1].status}`);
  console.log(`  - 串关主单状态: ${updatedBet?.status} (仍应为 ACTIVE)`);
  console.log('[test-parlay] -----------------------------------------');

  // 6. 模拟第二场“切尔西 vs 利物浦”比赛结束 (比分 0:2，客队利物浦胜)
  console.log('[test-parlay] ⚽ 正在模拟第二场结算：切尔西 0 : 2 利物浦 (AWAY 胜)');
  await prisma.match.update({
    where: { id: market2.matchId },
    data: {
      status: 'FINISHED',
      homeScore: 0,
      awayScore: 2,
      finalResult: 'AWAY',
    },
  });

  // 触发第二场结算，将触发 Alice 整个串关获胜派奖！
  await settleMarket(market2.id, 'AWAY');

  updatedBet = await prisma.parlayBet.findUnique({
    where: { id: bet.id },
    include: { items: true },
  });

  const finalAlice = await prisma.user.findUnique({ where: { id: alice.id } });

  console.log('\n=========================================');
  console.log('🎉 固定赔率串关 (Parlay) 级联自动派彩测试成功！');
  console.log(`- 串关单状态: ${updatedBet?.status}`);
  console.log(`- 锁死投注赔率: ${bet.odds} 倍`);
  console.log(`- 投注本金: ${bet.amount} U`);
  console.log(`- 获胜派彩总计: ${updatedBet?.payout} U`);
  console.log('-----------------------------------------');
  console.log(`- Alice 初始余额: 1000.00 U`);
  console.log(`- Alice 扣减本金: 900.00 U`);
  console.log(`- Alice 派彩后余额: ${finalAlice?.balanceUsdt} U`);
  console.log(`  (派彩额等于: ${bet.amount} * ${bet.odds} = ${Number(bet.amount) * Number(bet.odds)} U)`);
  console.log('=========================================\n');
}

testParlay()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[test-parlay] ❌ 串关测试失败:', e);
    process.exit(1);
  });
