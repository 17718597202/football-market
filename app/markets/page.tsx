import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: { status?: string; comp?: string };
}) {
  const status = searchParams.status || 'OPEN';
  const currentComp = searchParams.comp || 'ALL';

  // 1. 获取所有有赛事数据的联赛列表进行分类导航展示
  const comps = await prisma.match.findMany({
    select: { competition: true },
    distinct: ['competition'],
  });
  const compList = comps.map((c) => c.competition).filter(Boolean);

  // 2. 组装过滤条件
  const where: any = { status };
  if (currentComp !== 'ALL') {
    where.match = { competition: currentComp };
  }

  const markets = await prisma.market.findMany({
    where,
    include: { match: true, options: true },
    orderBy: { lockAt: 'asc' },
    take: 100,
  });

  const tabs = [
    { key: 'OPEN', label: '进行中' },
    { key: 'LOCKED', label: '已锁定' },
    { key: 'RESOLVED', label: '已结算' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">市场</h1>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/markets?status=${t.key}&comp=${encodeURIComponent(currentComp)}`}
              className={
                'no-underline px-3 py-1 rounded-md text-sm ' +
                (status === t.key
                  ? 'bg-[var(--brand)] text-white'
                  : 'border border-[var(--border)] opacity-70')
              }
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 赛事大厅类别过滤横轴 */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-3 overflow-x-auto scrollbar-none">
        <Link
          href={`/markets?status=${status}&comp=ALL`}
          className={
            'no-underline px-3 py-1 rounded-full text-xs font-medium transition ' +
            (currentComp === 'ALL'
              ? 'bg-[var(--brand)] text-white font-bold'
              : 'border border-[var(--border)] opacity-75 hover:opacity-100')
          }
        >
          全部赛事
        </Link>
        {compList.map((c) => (
          <Link
            key={c}
            href={`/markets?status=${status}&comp=${encodeURIComponent(c)}`}
            className={
              'no-underline px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ' +
              (currentComp === c
                ? 'bg-[var(--brand)] text-white font-bold'
                : 'border border-[var(--border)] opacity-75 hover:opacity-100')
            }
          >
            {c}
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        {markets.length === 0 && (
          <div className="card text-center opacity-60">
            暂无 {currentComp !== 'ALL' ? `[${currentComp}] ` : ''}
            {tabs.find((t) => t.key === status)?.label}市场
          </div>
        )}
        {markets.map((m) => (
          <Link
            key={m.id}
            href={`/markets/${m.id}`}
            className="card flex items-center justify-between no-underline hover:border-brand-500"
          >
            <div className="flex-1">
              <div className="text-xs opacity-60">
                {m.match.competition} {m.type === 'CORRECT_SCORE' ? '· 比分波胆' : '· 胜平负'}
              </div>
              <div className="font-medium mt-0.5">{m.title}</div>
              <div className="text-xs opacity-60 mt-1">
                锁单 {new Date(m.lockAt).toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="opacity-60">奖池</div>
              <div className="font-bold text-base">
                {Number(m.totalStake).toFixed(2)} U
              </div>
              {m.status === 'RESOLVED' && m.winningKey && (
                <div className="tag tag-green mt-1">
                  胜方 {m.options.find((o) => o.key === m.winningKey)?.label || m.winningKey}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
