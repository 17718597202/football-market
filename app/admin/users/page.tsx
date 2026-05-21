import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import AdjustBalanceClient from './AdjustBalanceClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/login');
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { bets: true, deposits: true, withdrawals: true } } },
  });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">用户管理</h1>
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
                注册 {new Date(u.createdAt).toLocaleString('zh-CN')}
              </div>
              {u.tronAddress && (
                <div className="text-xs opacity-60 font-mono mt-1 break-all">
                  {u.tronAddress}
                </div>
              )}
            </div>
            <div className="text-right text-sm">
              <div className="font-bold">{Number(u.balanceUsdt).toFixed(2)} U</div>
              <div className="text-xs opacity-60 mt-1">
                冻结 {Number(u.frozenUsdt).toFixed(2)} · {u._count.bets} 注 ·{' '}
                {u._count.deposits} 充值
              </div>
              <AdjustBalanceClient userId={u.id} currentBalance={u.balanceUsdt} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
