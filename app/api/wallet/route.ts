import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ok, handleError } from '@/lib/api';

export async function GET() {
  try {
    const user = await requireUser();
    const txs = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const pendingWithdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id, status: { in: ['PENDING', 'APPROVED'] } },
      orderBy: { createdAt: 'desc' },
    });

    return ok({
      balance: user.balanceUsdt,
      frozen: user.frozenUsdt,
      bscAddress: user.bscAddress,
      hotWalletAddress: process.env.HOT_WALLET_ADDRESS || '',
      transactions: txs,
      pendingWithdrawals,
    });
  } catch (e) {
    return handleError(e);
  }
}
