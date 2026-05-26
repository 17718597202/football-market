/**
 * 串关安全风控与注水对账系统集成测试脚本
 * 运行命令：npx tsx scripts/test-secure-parlay.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { injectMarketLiquidity } from '../lib/liquidity-engine';
import { placeParlayBet, settleParlayItems, MIN_PARLAY_LIQUIDITY, MAX_LEG_ODDS, MAX_PARLAY_ODDS, MAX_PARLAY_PAYOUT } from '../lib/parlay';
import { settleMarket } from '../lib/pari-mutuel';
import Decimal from 'decimal.js';

const TEST_USER = 'test_parlay_user';

async function setupTestEnvironment() {
  console.log('[test] 初始化测试环境与虚拟账号...');
  
  // 1. 清理或创建测试用户
  let user = await prisma.user.findUnique({ where: { username: TEST_USER } });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { balanceUsdt: '10000.00', frozenUsdt: '0' },
    });
  } else {
    user = await prisma.user.create({
      data: {
        username: TEST_USER,
        passwordHash: 'test_password_hash',
        role: 'USER',
        balanceUsdt: '10000.00',
        frozenUsdt: '0',
      },
    });
  }

  // 2. 清理历史测试数据（按外键约束顺序，先删子表，后删父表）
  const testMatchHomeTeams = ['测试队A', '测试队B', '测试队C', '测试队X'];
  
  // 找出历史测试 Match 的 ID 列表
  const oldMatches = await prisma.match.findMany({
    where: { homeTeam: { in: testMatchHomeTeams } },
    select: { id: true },
  });
  const oldMatchIds = oldMatches.map(m => m.id);

  if (oldMatchIds.length > 0) {
    // 找出相关的 Market ID 列表
    const oldMarkets = await prisma.market.findMany({
      where: { matchId: { in: oldMatchIds } },
      select: { id: true },
    });
    const oldMarketIds = oldMarkets.map(m => m.id);

    if (oldMarketIds.length > 0) {
      // 删子表数据
      await prisma.parlayItem.deleteMany({ where: { marketId: { in: oldMarketIds } } });
      await prisma.bet.deleteMany({ where: { marketId: { in: oldMarketIds } } });
      await prisma.marketOption.deleteMany({ where: { marketId: { in: oldMarketIds } } });
      await prisma.market.deleteMany({ where: { id: { in: oldMarketIds } } });
    }

    // 删关联的 ParlayBet（由 parlayItem 关联）
    // 这里的 parlayBet 已经失去了关联的 item，我们可以全量清理测试账号名下的串关单
    await prisma.parlayBet.deleteMany({ where: { userId: user.id } });
    // 清理交易流水
    await prisma.transaction.deleteMany({ where: { userId: user.id } });
    
    // 删 Match 主表
    await prisma.match.deleteMany({ where: { id: { in: oldMatchIds } } });
  }

  // 3. 创建测试场次 A：极低流动性池子 (低于 500 U 门槛)
  console.log('[test] 创建场次 A (池子总额仅 20 U)...');
  const matchA = await prisma.match.create({
    data: {
      competition: '测试超级联赛',
      homeTeam: '测试队A',
      awayTeam: '测试队B',
      kickoffAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      markets: {
        create: {
          type: 'RESULT_1X2',
          title: '测试队A vs 测试队B - 胜平负',
          lockAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000),
          status: 'OPEN',
          totalStake: '20.00',
          options: {
            create: [
              { key: 'HOME', label: '测试队A 胜', totalStake: '10.00' },
              { key: 'DRAW', label: '平局', totalStake: '0.00' },
              { key: 'AWAY', label: '测试队B 胜', totalStake: '10.00' },
            ],
          },
        },
      },
    },
    include: { markets: { include: { options: true } } },
  });

  // 4. 创建测试场次 B：高倾斜池子 (测试单场最高赔率截断)
  console.log('[test] 创建场次 B (倾斜彩池，HOME 占 990 U，AWAY 占 10 U)...');
  const matchB = await prisma.match.create({
    data: {
      competition: '测试超级联赛',
      homeTeam: '测试队B',
      awayTeam: '测试队C',
      kickoffAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      markets: {
        create: {
          type: 'RESULT_1X2',
          title: '测试队B vs 测试队C - 胜平负',
          lockAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000),
          status: 'OPEN',
          totalStake: '1000.00',
          options: {
            create: [
              { key: 'HOME', label: '测试队B 胜', totalStake: '990.00' },
              { key: 'DRAW', label: '平局', totalStake: '0.00' },
              { key: 'AWAY', label: '测试队C 胜', totalStake: '10.00' },
            ],
          },
        },
      },
    },
    include: { markets: { include: { options: true } } },
  });

  // 5. 创建测试场次 C：高流动性平衡池子
  console.log('[test] 创建场次 C (常规大型池子，HOME 占 500 U，AWAY 占 500 U)...');
  const matchC = await prisma.match.create({
    data: {
      competition: '测试超级联赛',
      homeTeam: '测试队C',
      awayTeam: '测试队A',
      kickoffAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      markets: {
        create: {
          type: 'RESULT_1X2',
          title: '测试队C vs 测试队A - 胜平负',
          lockAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000),
          status: 'OPEN',
          totalStake: '1000.00',
          options: {
            create: [
              { key: 'HOME', label: '测试队C 胜', totalStake: '500.00' },
              { key: 'DRAW', label: '平局', totalStake: '0.00' },
              { key: 'AWAY', label: '测试队A 胜', totalStake: '500.00' },
            ],
          },
        },
      },
    },
    include: { markets: { include: { options: true } } },
  });

  return {
    user,
    marketA: matchA.markets[0],
    marketB: matchB.markets[0],
    marketC: matchC.markets[0],
  };
}

async function runTests() {
  console.log('\n=========================================================');
  console.log('             开始执行串关安全风控系统测试集');
  console.log('=========================================================\n');

  const { user, marketA, marketB, marketC } = await setupTestEnvironment();

  const optionA = marketA.options.find(o => o.key === 'HOME')!;
  const optionB = marketB.options.find(o => o.key === 'AWAY')!;
  const optionC = marketC.options.find(o => o.key === 'HOME')!;

  // -------------------------------------------------------------
  // 测试一：验证池子准入门槛 (低于 MIN_PARLAY_LIQUIDITY 则拦截)
  // -------------------------------------------------------------
  console.log('\n[测试 1] 验证准入门槛限制（池子少于 500 U）...');
  try {
    await placeParlayBet(user.id, '10.00', [
      { marketId: marketA.id, optionId: optionA.id },
      { marketId: marketC.id, optionId: optionC.id },
    ]);
    console.error('❌ 测试失败：未能成功拦截低流动性池子的串关投注！');
    process.exit(1);
  } catch (e: any) {
    if (e.message.includes('低于最低串关门槛')) {
      console.log(`\n  ✓ 测试通过！拦截成功，报错信息为: "${e.message}"`);
    } else {
      console.error('❌ 测试失败：抛出了未预期的异常:', e.message);
      process.exit(1);
    }
  }

  // -------------------------------------------------------------
  // 测试二：验证单场 Leg 赔率限制 (极度倾斜赔率 96.03x 封顶为 10.00x)
  // -------------------------------------------------------------
  console.log('\n[测试 2] 验证单场 Leg 赔率封顶限制...');
  // 重新加载池子，并使用合法的大池子进行串关（Match B + Match C）
  // Match B AWAY 本来赔率：(1000 * 0.97) / 10 = 97.00x。在我们限制下，应该自动封顶为 MAX_LEG_ODDS (10.00x)
  // Match C HOME 赔率：(1000 * 0.97) / 500 = 1.94x
  // 预期串单最终总赔率：10.00 * 1.94 = 19.40x
  const parlayBet1 = await placeParlayBet(user.id, '10.00', [
    { marketId: marketB.id, optionId: optionB.id },
    { marketId: marketC.id, optionId: optionC.id },
  ]);

  const items = await prisma.parlayItem.findMany({
    where: { parlayBetId: parlayBet1.id },
    orderBy: { marketId: 'asc' },
  });

  const legB = items.find(i => i.marketId === marketB.id)!;
  const legC = items.find(i => i.marketId === marketC.id)!;

  console.log(`  串关 Leg B (Match B AWAY) 固化赔率: ${legB.odds} (预期: ${MAX_LEG_ODDS.toFixed(2)})`);
  console.log(`  串关 Leg C (Match C HOME) 固化赔率: ${legC.odds} (预期: 1.94)`);
  console.log(`  串关主订单总赔率: ${parlayBet1.odds} (预期: 19.40)`);

  if (Number(legB.odds) === MAX_LEG_ODDS && Number(parlayBet1.odds) === 19.40) {
    console.log('  ✓ 测试通过！Leg 赔率上限完美封顶，未因彩池操纵而无限膨胀。');
  } else {
    console.error('❌ 测试失败：赔率计算与预期不符！');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // 测试三：验证整单总赔率封顶与单单最高派彩限制
  // -------------------------------------------------------------
  console.log('\n[测试 3] 验证单单最高派彩上限封顶 (MAX_PARLAY_PAYOUT = 5,000 USDT)...');
  // 我们投一笔大本金 300 U。按照 19.40x 赔率，派彩应为 300 * 19.40 = 5,820 U。
  // 在我们设置的单单最高派彩 5,000 U 风控限制下，最终结算时应当只派发 5,000 U。
  const parlayBet2 = await placeParlayBet(user.id, '300.00', [
    { marketId: marketB.id, optionId: optionB.id },
    { marketId: marketC.id, optionId: optionC.id },
  ]);

  console.log(`  下单成功，串单 ID: ${parlayBet2.id}，投注金额: ${parlayBet2.amount} U，总赔率: ${parlayBet2.odds}`);

  // 模拟两个单场结算都获胜
  console.log('  模拟对账结算，将两个单场标记为获胜，触发串关自动兑奖...');
  await prisma.$transaction(async (tx) => {
    // 级联结算单场 B：胜方是 AWAY (测试队C胜)
    await settleParlayItems(tx, marketB.id, 'AWAY', false);
    // 级联结算单场 C：胜方是 HOME (测试队C胜)
    await settleParlayItems(tx, marketC.id, 'HOME', false);
  });

  // 检查订单最终派彩金额与流水记录
  const settledBet = await prisma.parlayBet.findUnique({
    where: { id: parlayBet2.id },
  });

  const transaction = await prisma.transaction.findFirst({
    where: { refType: 'BET', refId: parlayBet2.id, type: 'BET_PAYOUT' },
  });

  console.log(`  结算状态: ${settledBet?.status}`);
  console.log(`  结算派彩额: ${settledBet?.payout} U (预期: ${MAX_PARLAY_PAYOUT.toFixed(2)})`);
  console.log(`  交易流水记录 Remark: "${transaction?.remark}"`);

  if (settledBet?.status === 'WON' && Number(settledBet.payout) === MAX_PARLAY_PAYOUT && transaction?.remark.includes('触发单单最高派彩上限封顶')) {
    console.log('  ✓ 测试通过！整单最高派彩金额强行截断为 5,000 U，风控账目记录清晰。');
  } else {
    console.error('❌ 测试失败：最高派彩未被截断，或没有写入截断说明！');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // 测试四：验证重构后的系统机器人注水引擎（账目对账 consistency）
  // -------------------------------------------------------------
  console.log('\n[测试 4] 验证系统机器人注水与账目 100% 对账闭环...');
  
  // 创建一个全新的干净测试市场
  const newMatch = await prisma.match.create({
    data: {
      competition: '测试超级联赛',
      homeTeam: '测试队X',
      awayTeam: '测试队Y',
      kickoffAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      markets: {
        create: {
          type: 'RESULT_1X2',
          title: '测试队X vs 测试队Y - 胜平负',
          lockAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 - 5 * 60 * 1000),
          status: 'OPEN',
          options: {
            create: [
              { key: 'HOME', label: '测试队X 胜' },
              { key: 'DRAW', label: '平局' },
              { key: 'AWAY', label: '测试队Y 胜' },
            ],
          },
        },
      },
    },
    include: { markets: { include: { options: true } } },
  });

  const newMarket = newMatch.markets[0];
  console.log(`  已为 [测试队X vs 测试队Y] 新建玩法，开始执行机器人对账一致性注水...`);
  
  await injectMarketLiquidity(newMarket.id);

  // 重新从数据库拉取注入后的最新数据
  const injectedMarket = await prisma.market.findUnique({
    where: { id: newMarket.id },
    include: { options: true },
  });

  const injectedBets = await prisma.bet.findMany({
    where: { marketId: newMarket.id },
  });

  console.log(`  机器人生成真实 Bet 数量: ${injectedBets.length} 个`);
  
  let betsTotalSum = new Decimal(0);
  for (const b of injectedBets) {
    betsTotalSum = betsTotalSum.plus(new Decimal(b.amount));
  }

  const dbMarketTotalStake = new Decimal(injectedMarket!.totalStake);
  
  let dbOptionsTotalStake = new Decimal(0);
  for (const opt of injectedMarket!.options) {
    dbOptionsTotalStake = dbOptionsTotalStake.plus(new Decimal(opt.totalStake));
  }

  console.log(`  订单记录金额求和 sum(Bet.amount) = ${betsTotalSum.toFixed(2)} U`);
  console.log(`  玩法表字段记录 Market.totalStake = ${dbMarketTotalStake.toFixed(2)} U`);
  console.log(`  选项表字段求和 sum(Option.totalStake) = ${dbOptionsTotalStake.toFixed(2)} U`);

  const reconciled = betsTotalSum.equals(dbMarketTotalStake) && betsTotalSum.equals(dbOptionsTotalStake);
  if (reconciled && injectedBets.length > 0) {
    console.log('  ✓ 测试通过！数据库中的彩池总额 100% 由底层真实机器人下注订单组成，账目无可辩驳地一致！');
  } else {
    console.error('❌ 测试失败：对账失败，三处金额不相等！');
    process.exit(1);
  }

  console.log('\n=========================================================');
  console.log('            🎉 恭喜！所有串关安全风控测试通过！ 🎉');
  console.log('=========================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('测试运行异常中断:', e);
    process.exit(1);
  });
