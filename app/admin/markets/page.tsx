import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import MarketsAdminClient from './MarketsAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminMarketsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/login');

  const markets = await prisma.market.findMany({
    include: {
      match: true,
      options: true,
      _count: { select: { bets: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <MarketsAdminClient
      markets={markets.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        lockAt: m.lockAt.toISOString(),
        settledAt: m.settledAt?.toISOString() || null,
        match: { ...m.match, kickoffAt: m.match.kickoffAt.toISOString() },
      })) as any}
    />
  );
}
