import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/login');

  const [users, openMarkets, lockedMarkets, resolvedMarkets, pendingWd, bets] =
    await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.market.count({ where: { status: 'OPEN' } }),
      prisma.market.count({ where: { status: 'LOCKED' } }),
      prisma.market.count({ where: { status: 'RESOLVED' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.bet.count(),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">管理后台</h1>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Stat label="用户" value={users} />
        <Stat label="进行中" value={openMarkets} />
        <Stat label="已锁定" value={lockedMarkets} />
        <Stat label="已结算" value={resolvedMarkets} />
        <Stat label="待审提现" value={pendingWd} highlight={pendingWd > 0} />
        <Stat label="累计下注" value={bets} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AdminCard href="/admin/markets" title="市场管理" desc="创建/锁定/结算市场" />
        <AdminCard href="/admin/sync" title="同步赛程" desc="从 football-data 拉取" />
        <AdminCard href="/admin/withdrawals" title="提现审核" desc="审批用户提现申请" />
        <AdminCard href="/admin/users" title="用户管理" desc="查看用户与流水" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={'card text-center ' + (highlight ? 'border-yellow-500' : '')}>
      <div className="text-xs opacity-60">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function AdminCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="card no-underline hover:border-brand-500">
      <div className="font-bold">{title}</div>
      <div className="text-sm opacity-60 mt-1">{desc}</div>
    </Link>
  );
}
