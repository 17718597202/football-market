import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getDictionary, getLocale } from '@/lib/i18n';
import { getLocalizedTeam, getLocalizedComp } from '@/lib/translation';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dict = getDictionary();
  const locale = getLocale();
  const stats = await Promise.all([
    prisma.market.count({ where: { status: 'OPEN' } }),
    prisma.bet.count(),
    prisma.user.count({ where: { role: 'USER' } }),
  ]);
  const upcomingMatches = await prisma.match.findMany({
    where: {
      markets: {
        some: { status: 'OPEN', lockAt: { gt: new Date() } }
      }
    },
    include: {
      markets: {
        where: { status: 'OPEN', lockAt: { gt: new Date() } },
      }
    },
    orderBy: { kickoffAt: 'asc' },
    take: 5,
  });

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden card border-0 bg-transparent flex flex-col md:flex-row items-center justify-center text-center p-12 min-h-[300px]">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(234,179,8,0.1)] to-transparent pointer-events-none rounded-2xl"></div>
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#fef08a] via-[#eab308] to-[#ca8a04] drop-shadow-sm">
              {dict.home.heroTitle}
            </span>
          </h1>
          <p className="opacity-80 text-lg leading-relaxed">
            {dict.home.heroSub}
          </p>
          <div className="pt-4">
            <Link href="/markets" className="btn px-8 py-3 text-lg font-bold shadow-[0_0_20px_rgba(234,179,8,0.3)] no-underline">
              {dict.home.browseMarkets}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[rgba(16,185,129,0.05)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="text-4xl font-extrabold text-[#fef08a]">{stats[0]}</div>
          <div className="text-sm opacity-60 mt-2 tracking-widest uppercase font-semibold">{dict.home.activeMarkets}</div>
        </div>
        <div className="card text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[rgba(234,179,8,0.05)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="text-4xl font-extrabold text-[#fef08a]">{stats[1]}</div>
          <div className="text-sm opacity-60 mt-2 tracking-widest uppercase font-semibold">{dict.home.totalBets}</div>
        </div>
        <div className="card text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[rgba(16,185,129,0.05)] opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="text-4xl font-extrabold text-[#fef08a]">{stats[2]}</div>
          <div className="text-sm opacity-60 mt-2 tracking-widest uppercase font-semibold">{dict.home.registeredUsers}</div>
        </div>
      </section>

      {/* Upcoming Matches */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-[#eab308] rounded-full shadow-[0_0_10px_rgba(234,179,8,0.6)]"></div>
          <h2 className="text-2xl font-bold">{dict.home.upcomingMatches}</h2>
        </div>
        <div className="space-y-4">
          {upcomingMatches.length === 0 && (
            <div className="card text-center py-12 opacity-60 text-lg border-dashed">
              {dict.home.noUpcoming}
            </div>
          )}
          {upcomingMatches.map((match) => (
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
                    <span className="font-medium text-[var(--text)] group-hover/market:text-[#fef08a] transition-colors">
                      {dict.market.types[m.type as keyof typeof dict.market.types] || m.type}
                    </span>
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
      </section>
    </div>
  );
}
