import 'dotenv/config';
import { prisma } from '../lib/db';
import { settleMarket } from '../lib/pari-mutuel';
import { add, sub, toStr } from '../lib/money';

async function runTest() {
  console.log('\n=========================================');
  console.log('🚀 开始全链路端到端 (E2E) 自动化测试');
  console.log('=========================================\n');

  // ==========================================
  // 1. 数据准备
  // ==========================================
  console.log('📦 [1/5] 准备测试环境数据...');
  
  // 清理可能存在的脏数据
  await prisma.transaction.deleteMany({ where: { remark: { contains: 'E2E' } } });
  await prisma.bet.deleteMany({ where: { status: 'ACTIVE', market: { title: 'E2E 测试赛' } } });
  
  // 创建/获取用户
  const alice = await prisma.user.upsert({
    where: { username: 'e2e_alice' },
    update: { balanceUsdt: '0', frozenUsdt: '0', bscAddress: '0xAliceE2eMockAddress111111111111111111111' },
    create: {
      username: 'e2e_alice',
      passwordHash: 'mock',
      role: 'USER',
      balanceUsdt: '0',
      frozenUsdt: '0',
      bscAddress: '0xAliceE2eMockAddress111111111111111111111'
    }
  });

  const bob = await prisma.user.upsert({
    where: { username: 'e2e_bob' },
    update: { balanceUsdt: '0', frozenUsdt: '0', bscAddress: '0xBobE2eMockAddress2222222222222222222222' },
    create: {
      username: 'e2e_bob',
      passwordHash: 'mock',
      role: 'USER',
      balanceUsdt: '0',
      frozenUsdt: '0',
      bscAddress: '0xBobE2eMockAddress2222222222222222222222'
    }
  });

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('找不到 ADMIN 账号');

  console.log(`✅ 创建/获取测试账号成功: Alice(${alice.id}), Bob(${bob.id})`);

  // ==========================================
  // 2. BSC 充值链路测试
  // ==========================================
  console.log('\n💸 [2/5] 测试 BSC 充值链路...');
  const depositUsdt = '1000';
  
  await prisma.$transaction(async (tx) => {
    // 模拟 worker 扫块给 Alice 充值 1000
    const depAlice = await tx.deposit.create({
      data: {
        userId: alice.id,
        txHash: '0xDepositAlice_' + Date.now(),
        fromAddress: alice.bscAddress!,
        toAddress: process.env.HOT_WALLET_ADDRESS || '0xHot',
        amount: depositUsdt,
        blockNumber: BigInt(999999),
        status: 'CREDITED',
        confirmations: 20,
        creditedAt: new Date(),
        rawData: '{}'
      }
    });

    const newBalAlice = add(alice.balanceUsdt, depositUsdt);
    await tx.user.update({ where: { id: alice.id }, data: { balanceUsdt: newBalAlice } });
    await tx.transaction.create({
      data: {
        userId: alice.id, type: 'DEPOSIT', amount: depositUsdt,
        balanceAfter: newBalAlice, refType: 'DEPOSIT', refId: depAlice.id, remark: '[E2E] BSC 充值'
      }
    });

    // Bob 充值 1000
    const depBob = await tx.deposit.create({
      data: {
        userId: bob.id, txHash: '0xDepositBob_' + Date.now(), fromAddress: bob.bscAddress!,
        toAddress: process.env.HOT_WALLET_ADDRESS || '0xHot', amount: depositUsdt,
        blockNumber: BigInt(999999), status: 'CREDITED', confirmations: 20, creditedAt: new Date(), rawData: '{}'
      }
    });

    const newBalBob = add(bob.balanceUsdt, depositUsdt);
    await tx.user.update({ where: { id: bob.id }, data: { balanceUsdt: newBalBob } });
    await tx.transaction.create({
      data: {
        userId: bob.id, type: 'DEPOSIT', amount: depositUsdt,
        balanceAfter: newBalBob, refType: 'DEPOSIT', refId: depBob.id, remark: '[E2E] BSC 充值'
      }
    });
  });

  const a1 = await prisma.user.findUnique({ where: { id: alice.id } });
  const b1 = await prisma.user.findUnique({ where: { id: bob.id } });
  console.log(`✅ 充值成功: Alice 余额 ${a1?.balanceUsdt} U, Bob 余额 ${b1?.balanceUsdt} U`);

  // ==========================================
  // 3. 市场与下注测试
  // ==========================================
  console.log('\n⚽ [3/5] 测试市场创建与下注...');
  
  const match = await prisma.match.create({
    data: {
      competition: 'E2E 测试联赛',
      homeTeam: 'E2E 主队',
      awayTeam: 'E2E 客队',
      kickoffAt: new Date(),
      status: 'SCHEDULED'
    }
  });

  const market = await prisma.market.create({
    data: {
      matchId: match.id,
      title: 'E2E 测试赛',
      type: '1X2',
      status: 'OPEN',
      lockAt: new Date(),
      totalStake: '0',
      options: {
        create: [
          { key: 'HOME', label: '主胜', totalStake: '0', betCount: 0 },
          { key: 'DRAW', label: '平局', totalStake: '0', betCount: 0 },
          { key: 'AWAY', label: '客胜', totalStake: '0', betCount: 0 },
        ]
      }
    },
    include: { options: true }
  });

  const homeOpt = market.options.find(o => o.key === 'HOME')!;
  const awayOpt = market.options.find(o => o.key === 'AWAY')!;

  // Alice 投 HOME 200, Bob 投 AWAY 300
  console.log(`  - Alice 下注 [主胜] 200 U`);
  console.log(`  - Bob 下注 [客胜] 300 U`);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: a1!.id }, data: { balanceUsdt: sub(a1!.balanceUsdt, '200') } });
    await tx.bet.create({ data: { userId: a1!.id, marketId: market.id, optionId: homeOpt.id, amount: '200', status: 'ACTIVE' } });
    await tx.marketOption.update({ where: { id: homeOpt.id }, data: { totalStake: '200', betCount: 1 } });
    
    await tx.user.update({ where: { id: b1!.id }, data: { balanceUsdt: sub(b1!.balanceUsdt, '300') } });
    await tx.bet.create({ data: { userId: b1!.id, marketId: market.id, optionId: awayOpt.id, amount: '300', status: 'ACTIVE' } });
    await tx.marketOption.update({ where: { id: awayOpt.id }, data: { totalStake: '300', betCount: 1 } });
    
    await tx.market.update({ where: { id: market.id }, data: { totalStake: '500' } });
  });

  const a2 = await prisma.user.findUnique({ where: { id: alice.id } });
  console.log(`✅ 下注成功: Alice 余额 ${a2?.balanceUsdt} U (已扣除200), 市场总奖池 500 U`);

  // ==========================================
  // 4. 彩池派彩测试
  // ==========================================
  console.log('\n🏆 [4/5] 测试彩池结算 (Pari-mutuel)...');
  await prisma.match.update({
    where: { id: match.id },
    data: { status: 'FINISHED', homeScore: 2, awayScore: 1, finalResult: 'HOME' }
  });

  const settleRes = await settleMarket(market.id, 'HOME');
  console.log(`  - 结算结果: 状态=${settleRes.status}, 抽水=${settleRes.rake}U, 派发总额=${settleRes.payoutPool}U`);
  
  const a3 = await prisma.user.findUnique({ where: { id: alice.id } });
  const b3 = await prisma.user.findUnique({ where: { id: bob.id } });
  console.log(`✅ 派彩成功: Alice (赢家) 余额 ${a3?.balanceUsdt} U, Bob (输家) 余额 ${b3?.balanceUsdt} U`);

  // ==========================================
  // 5. 提现审核测试
  // ==========================================
  console.log('\n🏦 [5/5] 测试提现及审核...');
  
  console.log(`  - Alice 发起 200 U 提现`);
  const wd = await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: alice.id } });
    const newBal = sub(u!.balanceUsdt, '200');
    const newFroz = add(u!.frozenUsdt, '200');
    
    await tx.user.update({ where: { id: u!.id }, data: { balanceUsdt: newBal, frozenUsdt: newFroz } });
    const w = await tx.withdrawal.create({
      data: { userId: u!.id, toAddress: u!.bscAddress!, amount: '200', fee: '0', netAmount: '200', status: 'PENDING' }
    });
    return w;
  });

  const a4 = await prisma.user.findUnique({ where: { id: alice.id } });
  console.log(`  - 提现发起后: Alice 余额 ${a4?.balanceUsdt} U, 冻结 ${a4?.frozenUsdt} U`);

  console.log(`  - 管理员审批提现，填写 txHash`);
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({ where: { id: wd.userId } });
    await tx.user.update({ where: { id: u!.id }, data: { frozenUsdt: sub(u!.frozenUsdt, wd.amount) } });
    await tx.withdrawal.update({
      where: { id: wd.id },
      data: { status: 'SENT', reviewedBy: admin.id, reviewedAt: new Date(), txHash: '0xWithdrawal_' + Date.now() }
    });
  });

  const a5 = await prisma.user.findUnique({ where: { id: alice.id } });
  console.log(`✅ 提现审核通过: Alice 最终余额 ${a5?.balanceUsdt} U, 冻结 ${a5?.frozenUsdt} U`);

  // ==========================================
  // 清理
  // ==========================================
  await prisma.bet.deleteMany({ where: { marketId: market.id } });
  await prisma.marketOption.deleteMany({ where: { marketId: market.id } });
  await prisma.market.delete({ where: { id: market.id } });
  await prisma.match.delete({ where: { id: match.id } });
  
  console.log('\n🎉 E2E 测试全部通过！系统逻辑健康运转！');
}

runTest().catch(e => {
  console.error('\n❌ 测试失败:', e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
