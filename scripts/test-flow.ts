import 'dotenv/config';
import { prisma } from '../lib/db';
import { signSession } from '../lib/auth';
import { add, sub, toStr } from '../lib/money';

async function run() {
  const user = await prisma.user.findUnique({ where: { username: '18833687737' } });
  if (!user) {
    console.error('User not found');
    return;
  }

  console.log(`[Test] 当前余额: ${user.balanceUsdt}, 冻结: ${user.frozenUsdt}`);
  
  const token = await signSession({ sub: user.id, username: user.username, role: user.role as 'ADMIN' });
  const cookie = `yuce_session=${token}`;

  // 1. 模拟充值 (类似 scan-deposits 脚本扫到了区块)
  console.log('\n--- 1. 模拟链上充值 100 USDT ---');
  await prisma.$transaction(async (tx) => {
    const depositAmount = '100';
    const dep = await tx.deposit.create({
      data: {
        userId: user.id,
        txHash: 'mock_tx_' + Date.now(),
        fromAddress: 'T_mock_sender',
        toAddress: 'T_mock_hotwallet',
        amount: depositAmount,
        blockNumber: BigInt(12345),
        status: 'CREDITED',
        confirmations: 20,
        creditedAt: new Date(),
      }
    });

    const newBalance = add(user.balanceUsdt, depositAmount);
    await tx.user.update({
      where: { id: user.id },
      data: { balanceUsdt: newBalance }
    });
    
    await tx.transaction.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amount: depositAmount,
        balanceAfter: newBalance,
        refType: 'DEPOSIT',
        refId: dep.id,
        remark: '测试模拟充值',
      }
    });
  });
  
  const userAfterDep = await prisma.user.findUnique({ where: { id: user.id } });
  console.log(`[Test] 充值后余额: ${userAfterDep?.balanceUsdt}`);

  // 2. 模拟发起提现请求 (调用 API)
  console.log('\n--- 2. 模拟发起提现请求 30 USDT ---');
  // 我们直接调用 withdrawal 的 API 逻辑，但是为了方便这里直接使用内部的 fetch 无法带有完整 next.js 上下文
  // 所以我们可以直接在 Node 中起个本地 fetch 调用 localhost:3000
  // 确保你的 npm run dev 在运行
  
  const wdRes = await fetch('http://localhost:3000/api/wallet/withdraw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      toAddress: 'TSFtZwrS1QpgazpggtRktuMgTAGUAMibTL', // valid tron address format
      amount: '30'
    })
  });
  const wdData = await wdRes.json();
  if (!wdData.ok) {
    console.error('提现发起失败:', wdData.error);
    return;
  }
  const wdId = wdData.data.id;
  console.log(`[Test] 提现申请成功，生成提现单 ID: ${wdId}`);
  
  const userAfterWd = await prisma.user.findUnique({ where: { id: user.id } });
  console.log(`[Test] 提现申请后余额: ${userAfterWd?.balanceUsdt}, 冻结: ${userAfterWd?.frozenUsdt}`);

  // 3. 模拟管理员手动打款并审核通过 (调用 API)
  console.log('\n--- 3. 模拟管理员手动打款并后台批准 ---');
  const reviewRes = await fetch(`http://localhost:3000/api/admin/withdrawals/${wdId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      action: 'APPROVE',
      remark: '测试打款通过',
      txHash: 'mock_out_tx_' + Date.now()
    })
  });
  const reviewData = await reviewRes.json();
  if (!reviewData.ok) {
    console.error('审核失败:', reviewData.error);
    return;
  }
  console.log(`[Test] 管理员审核并记录 txHash 成功`);
  
  const finalUser = await prisma.user.findUnique({ where: { id: user.id } });
  console.log(`[Test] 最终余额: ${finalUser?.balanceUsdt}, 最终冻结: ${finalUser?.frozenUsdt}`);
  console.log('\n✅ 充值 -> 提现发起 -> 管理员打款审核 的整个业务流测试通过！');
}

run().catch(console.error).finally(() => process.exit(0));
