/**
 * TRC20 USDT 充值扫描器
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
import { fetchTrc20Transfers, getTronConfig } from '../lib/tron';

const INTERVAL_MS =
  Number(process.env.SCAN_INTERVAL_SECONDS || 30) * 1000;

async function tick() {
  const cfg = getTronConfig();
  if (!cfg.hotWallet) {
    console.warn('[scan] HOT_WALLET_ADDRESS 未配置，跳过');
    return;
  }

  let cursor = await prisma.scanCursor.findUnique({ where: { id: 'trc20_usdt' } });
  if (!cursor) {
    cursor = await prisma.scanCursor.create({
      data: { id: 'trc20_usdt', lastTimestamp: BigInt(Date.now() - 24 * 3600 * 1000) },
    });
  }

  const minTs = Number(cursor.lastTimestamp);
  console.log(`[scan] 拉取 ${cfg.hotWallet} 自 ${new Date(minTs).toISOString()} 起的入账`);

  let transfers: Awaited<ReturnType<typeof fetchTrc20Transfers>>;
  try {
    transfers = await fetchTrc20Transfers(cfg.hotWallet, {
      onlyConfirmed: true,
      limit: 50,
      minTimestampMs: minTs,
    });
  } catch (e: any) {
    console.error('[scan] TronGrid 错误:', e.message);
    return;
  }

  let latestTs = minTs;
  for (const t of transfers) {
    if (t.to.toLowerCase() !== cfg.hotWallet.toLowerCase()) continue;
    if (t.blockTimestamp > latestTs) latestTs = t.blockTimestamp;

    // 去重
    const dup = await prisma.deposit.findUnique({ where: { txHash: t.txHash } });
    if (dup) continue;

    const user = await prisma.user.findUnique({ where: { tronAddress: t.from } });

    await prisma.$transaction(async (tx) => {
      const dep = await tx.deposit.create({
        data: {
          userId: user?.id,
          txHash: t.txHash,
          fromAddress: t.from,
          toAddress: t.to,
          amount: toStr(t.amountUsdt),
          blockNumber: BigInt(0), // 简化：TronGrid 该接口未直接返回 block number
          status: user ? 'CREDITED' : 'UNMATCHED',
          confirmations: 20,
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
            remark: `TRC20 充值 ${t.txHash.slice(0, 10)}...`,
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

  if (latestTs > minTs) {
    await prisma.scanCursor.update({
      where: { id: 'trc20_usdt' },
      data: { lastTimestamp: BigInt(latestTs) },
    });
  }
}

async function main() {
  console.log('[scan] TRC20 USDT 扫块器启动，间隔', INTERVAL_MS / 1000, '秒');
  while (true) {
    try {
      await tick();
    } catch (e) {
      console.error('[scan] tick 出错:', e);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
