import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getDictionary, getLocale } from '@/lib/i18n';
import { getLocalizedTeam, getLocalizedComp } from '@/lib/translation';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: { status?: string; comp?: string };
}) {
  const dict = getDictionary();
  const locale = getLocale();
  const status = searchParams.status || 'OPEN';
  const currentComp = searchParams.comp || 'ALL';

  // 1. 获取所有有赛事数据的联赛列表进行分类导航展示
  const comps = await prisma.match.findMany({
    select: { competition: true },
    distinct: ['competition'],
  });
  const compList = comps.map((c) => c.competition).filter(Boolean);

  // 2. 组装过滤条件
  const matchWhere: any = {
    markets: { some: { status: status } }
  };
  if (status === 'OPEN') {
    matchWhere.markets.some.lockAt = { gt: new Date() };
  }
  if (currentComp !== 'ALL') {
    matchWhere.competition = currentComp;
  }

  const matches = await prisma.match.findMany({
    where: matchWhere,
    include: {
      markets: {
        where: status === 'OPEN' ? { status, lockAt: { gt: new Date() } } : { status },
        include: { options: true },
      }
    },
    orderBy: { kickoffAt: 'asc' },
    take: 50,
  });

  const tabs = [
    { key: 'OPEN', label: dict.market.tabs.OPEN },
    { key: 'LOCKED', label: dict.market.tabs.LOCKED },
    { key: 'RESOLVED', label: dict.market.tabs.RESOLVED },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{dict.market.title}</h1>
        <div className="flex gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/markets?status=${t.key}&comp=${encodeURIComponent(currentComp)}`}
              className={
                'no-underline px-3 py-1 rounded-md text-sm ' +
                (status === t.key
                  ? 'bg-[var(--brand)] text-black font-bold'
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
              ? 'bg-[var(--brand)] text-black font-bold'
              : 'border border-[var(--border)] opacity-75 hover:opacity-100')
          }
        >
          {dict.market.allComps}
        </Link>
        {compList.map((c) => (
          <Link
            key={c}
            href={`/markets?status=${status}&comp=${encodeURIComponent(c)}`}
            className={
              'no-underline px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ' +
              (currentComp === c
                ? 'bg-[var(--brand)] text-black font-bold'
                : 'border border-[var(--border)] opacity-75 hover:opacity-100')
            }
          >
            {c}
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        {matches.length === 0 && (
          <div className="card text-center opacity-60">
            {dict.market.empty.replace('{status}', tabs.find((t) => t.key === status)?.label || status).replace('{comp}', currentComp === 'ALL' ? '' : `[${currentComp}]`)}
          </div>
        )}
        {matches.map((match) => (
          <div key={match.id} className="card group hover:border-[#eab308] transition-colors p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
              <div>
                <div className="text-sm opacity-60 mb-1.5 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[rgba(255,255,255,0.05)] text-[#fef08a] font-medium">{getLocalizedComp(match.competition, locale)}</span>
                  <span>·</span>
                  <LocalTime date={match.kickoffAt} locale={locale} />
                </div>
                <div className="font-extrabold text-2xl group-hover:text-[#fef08a] transition-colors">
                  {getLocalizedTeam(match.homeTeam, locale)} <span className="opacity-50 font-medium text-lg mx-2">vs</span> {getLocalizedTeam(match.awayTeam, locale)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-[var(--border)]">
              {match.markets.map((m) => (
                <Link
                  key={m.id}
                  href={`/markets/${m.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(234,179,8,0.1)] border border-transparent hover:border-[rgba(234,179,8,0.3)] transition-all no-underline group/market"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--text)] group-hover/market:text-[#fef08a] transition-colors">
                      {dict.market.types[m.type as keyof typeof dict.market.types] || m.type}
                    </span>
                    {m.status === 'RESOLVED' && m.winningKey && (
                      <span className="text-[10px] text-[#10b981] mt-1 font-bold">
                        {dict.market.winner}: {m.options.find((o) => o.key === m.winningKey)?.label || m.winningKey}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] opacity-60 uppercase tracking-wider leading-none mb-1">{dict.home.pool}</div>
                    <div className="font-bold text-[#10b981] leading-none">
                      {Number(m.totalStake).toFixed(2)} U
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
