import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api';

export async function GET() {
  try {
    await requireAdmin();
    const [userCount, openMarkets, lockedMarkets, resolvedMarkets, pendingWd, betCount] =
      await Promise.all([
        prisma.user.count({ where: { role: 'USER' } }),
        prisma.market.count({ where: { status: 'OPEN' } }),
        prisma.market.count({ where: { status: 'LOCKED' } }),
        prisma.market.count({ where: { status: 'RESOLVED' } }),
        prisma.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma.bet.count(),
      ]);
    return ok({
      userCount,
      openMarkets,
      lockedMarkets,
      resolvedMarkets,
      pendingWithdrawals: pendingWd,
      betCount,
    });
  } catch (e) {
    return handleError(e);
  }
}
