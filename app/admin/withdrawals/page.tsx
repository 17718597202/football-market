import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import WithdrawalsClient from './WithdrawalsClient';

export const dynamic = 'force-dynamic';

export default async function AdminWithdrawalsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/login');
  const list = await prisma.withdrawal.findMany({
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <WithdrawalsClient
      list={list.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        reviewedAt: w.reviewedAt?.toISOString() || null,
      })) as any}
    />
  );
}
