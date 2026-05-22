import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import AdjustBalanceClient from './AdjustBalanceClient';
import { getDictionary } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/login');
  const dict = getDictionary();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { bets: true, deposits: true, withdrawals: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{dict.admin.users}</h1>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card flex items-center justify-between">
            <div className="flex-1">
              <div className="font-bold">
                {u.username}
                {u.role === 'ADMIN' && (
                  <span className="tag tag-yellow ml-2">ADMIN</span>
                )}
              </div>
              <div className="text-xs opacity-60 mt-1">
                {dict.admin.register} {new Date(u.createdAt).toLocaleString()}
              </div>
              {u.bscAddress && (
                <div className="text-xs opacity-60 font-mono mt-1 break-all">
                  {u.bscAddress}
                </div>
              )}
            </div>
            <div className="text-right text-sm">
              <div className="font-bold">{Number(u.balanceUsdt).toFixed(2)} U</div>
              <div className="text-xs opacity-60 mt-1">
                {dict.admin.frozen} {Number(u.frozenUsdt).toFixed(2)} · {u._count.bets} {dict.admin.bets} ·{' '}
                {u._count.deposits} {dict.admin.deposits}
              </div>
              <AdjustBalanceClient userId={u.id} currentBalance={u.balanceUsdt} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
