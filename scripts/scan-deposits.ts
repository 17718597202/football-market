/**
 * BSC BEP20 USDT 充值扫描器
 * - 轮询热钱包地址的入账记录
 * - 通过 fromAddress 匹配已绑定该地址的用户
 * - 写入 Deposit 表 + 增加用户余额（带去重）
 *
 * 启动：npm run scan:deposits
 * 部署：作为常驻 worker 运行（pm2 / systemd / docker）
 */
import 'dotenv/config';
import { prisma } from '../lib/db';
import { add, toStr } from '../lib/money';
import { fetchBep20Transfers, getBscConfig, getCurrentBlock } from '../lib/bsc';

const INTERVAL_MS = Number(process.env.SCAN_INTERVAL_SECONDS || 30) * 1000;

async function tick(): Promise<boolean> {
  const cfg = getBscConfig();
  if (!cfg.hotWallet) {
    console.warn('[scan] HOT_WALLET_ADDRESS 未配置，跳过');
    return true;
  }

  let cursor = await prisma.scanCursor.findUnique({ where: { id: 'bep20_usdt' } });
  if (!cursor) {
    // 首次启动时，从当前区块开始，避免把别人几年前的转账扫出来
    const currentBlock = await getCurrentBlock();
    cursor = await prisma.scanCursor.create({
      data: { id: 'bep20_usdt', lastBlockNumber: BigInt(currentBlock - 100) }, // 往前推100块作为冗余
    });
  }

  let minBlock = Number(cursor.lastBlockNumber);
  const currentBlock = await getCurrentBlock();
  
  if (minBlock >= currentBlock) {
    return true; // 没有新区块，已追上
  }

  // 每次并发扫 5 个区块，防止免费节点并发限制而卡死
  const step = Math.min(5, currentBlock - minBlock);
  const maxBlock = minBlock + step;

  if (currentBlock - minBlock > 100) {
    console.log(`[scan] ⚠️ 严重落后！当前区块 ${currentBlock}，游标 ${minBlock}，正在加速追赶... (当前并发批次: ${minBlock + 1} - ${maxBlock})`);
  }

  let allTransfers: any[] = [];
  try {
    const promises = [];
    for (let b = minBlock + 1; b <= maxBlock; b++) {
      promises.push(fetchBep20Transfers(cfg.hotWallet, b));
    }
    const results = await Promise.all(promises);
    allTransfers = results.flat();
  } catch (e: any) {
    console.error('[scan] RPC 扫块错误:', e.message);
    return false;
  }

  for (const t of allTransfers) {
    if (t.to.toLowerCase() !== cfg.hotWallet.toLowerCase()) continue;


    // 去重
    const dup = await prisma.deposit.findUnique({ where: { txHash: t.txHash } });
    if (dup) continue;

    // 根据 EVM 地址匹配用户 (EVM 地址不区分大小写，这里为了安全起见可以在数据库使用忽略大小写查询，或者假设存入的都是 lowercased)
    // 更好的做法是转为小写查询，但 Prisma SQLite 区分大小写。我们先把用户的 bscAddress 统一按标准存。
    // 为了稳妥，我们用 findFirst 加忽略大小写（如果支持），或者在应用层保证 bscAddress 全是 lowercase 的。
    // 但是在这个 MVP 里，我们就用普通的 findFirst
    const users = await prisma.user.findMany({
      where: { bscAddress: { not: null } }
    });
    const user = users.find(u => u.bscAddress?.toLowerCase() === t.from.toLowerCase());

    await prisma.$transaction(async (tx) => {
      const dep = await tx.deposit.create({
        data: {
          userId: user?.id,
          txHash: t.txHash,
          fromAddress: t.from,
          toAddress: t.to,
          amount: toStr(t.amountUsdt),
          blockNumber: BigInt(t.blockNumber),
          status: user ? 'CREDITED' : 'UNMATCHED',
          confirmations: 20, // BscScan 已经确认过的
          rawData: JSON.stringify(t.rawData),
          creditedAt: user ? new Date() : null,
        },
      });
      if (user) {
        const newBalance = add(user.balanceUsdt, t.amountUsdt);
        await tx.user.update({
          where: { id: user.id },
          data: { balanceUsdt: newBalance },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'DEPOSIT',
            amount: t.amountUsdt,
            balanceAfter: newBalance,
            refType: 'DEPOSIT',
            refId: dep.id,
            remark: `BEP20 充值 ${t.txHash.slice(0, 10)}...`,
          },
        });
        console.log(
          `[scan] ✓ ${user.username} 充值 ${t.amountUsdt} U from ${t.from}`
        );
      } else {
        console.warn(
          `[scan] ⚠ 未匹配充值 ${t.amountUsdt} U from ${t.from} (txHash=${t.txHash})`
        );
      }
    });
  }

  await prisma.scanCursor.update({
    where: { id: 'bep20_usdt' },
    data: { lastBlockNumber: BigInt(maxBlock) },
  });

  return maxBlock >= currentBlock;
}

async function main() {
  console.log('[scan] BEP20 USDT 扫块器启动，间隔', INTERVAL_MS / 1000, '秒');
  while (true) {
    try {
      const caughtUp = await tick();
      if (caughtUp) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
      } else {
        await new Promise((r) => setTimeout(r, 100)); // 快速追赶时仅等待 100 毫秒进入下一轮
      }
    } catch (e) {
      console.error('[scan] tick 出错:', e);
      await new Promise((r) => setTimeout(r, 5000)); // 出错时等待 5 秒防止死循环打爆 RPC
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
