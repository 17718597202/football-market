import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { getLocalizedTeam, getLocalizedComp } from '@/lib/translation';
import BetPanel from './BetPanel';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';

export default async function MarketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const market = await prisma.market.findUnique({
    where: { id: params.id },
    include: {
      match: {
        include: {
          markets: {
            where: { id: { not: params.id } },
          },
        },
      },
      options: { orderBy: { id: 'asc' } },
    },
  });
  if (!market) notFound();

  const user = await getCurrentUser();
  const dict = getDictionary();
  const locale = getLocale();
  const myBets = user
    ? await prisma.bet.findMany({
        where: { marketId: market.id, userId: user.id },
        include: { option: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const totalStake = Number(market.totalStake);
  const rakeBps = market.rakeBps;

  const locHome = getLocalizedTeam(market.match.homeTeam, locale);
  const locAway = getLocalizedTeam(market.match.awayTeam, locale);
  const displayTitle = `${locHome} vs ${locAway} - ${dict.market.types[market.type as keyof typeof dict.market.types] || market.type}`;

  const getOptionLabel = (option: any) => {
    if (locale === 'zh') return option.label;
    if (option.key === 'HOME') return `${locHome} Win`;
    if (option.key === 'AWAY') return `${locAway} Win`;
    if (option.key === 'DRAW') return 'Draw';
    if (option.key === 'OTHER') return 'Other Score';
    return option.label;
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="text-xs opacity-60">{getLocalizedComp(market.match.competition, locale)}</div>
        <h1 className="text-xl font-bold mt-1">{displayTitle}</h1>
        {market.description && (
          <p className="text-sm opacity-70 mt-2">{market.description}</p>
        )}
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <div>
            <div className="opacity-60 text-xs">状态</div>
            <div className="mt-0.5">
              {market.status === 'OPEN' && <span className="tag tag-green">下注中</span>}
              {market.status === 'LOCKED' && <span className="tag tag-yellow">已锁定</span>}
              {market.status === 'RESOLVED' && <span className="tag tag-muted">已结算</span>}
              {market.status === 'VOIDED' && <span className="tag tag-red">已作废</span>}
            </div>
          </div>
          <div>
            <div className="opacity-60 text-xs">锁单时间</div>
            <div className="mt-0.5"><LocalTime date={market.lockAt} locale={locale} /></div>
          </div>
          <div>
            <div className="opacity-60 text-xs">奖池</div>
            <div className="mt-0.5 font-bold">{totalStake.toFixed(2)} U</div>
          </div>
          <div>
            <div className="opacity-60 text-xs">平台抽水</div>
            <div className="mt-0.5">{(rakeBps / 100).toFixed(2)}%</div>
          </div>
          {market.match.status === 'FINISHED' && (
            <div>
              <div className="opacity-60 text-xs">比分</div>
              <div className="mt-0.5 font-bold">
                {market.match.homeScore} : {market.match.awayScore}
              </div>
            </div>
          )}
        </div>
      </div>

      {market.match.markets.length > 0 && (
        <div className="card bg-[rgba(14,165,233,.04)] border border-[rgba(14,165,233,.12)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm font-medium">
            ⚽ 该场比赛目前支持多种预测玩法：
          </div>
          <div className="flex gap-2">
            {market.match.markets.map((other) => (
              <a
                key={other.id}
                href={`/markets/${other.id}`}
                className="no-underline text-xs bg-[var(--brand)] text-white font-semibold py-1.5 px-3.5 rounded-md shadow hover:brightness-110 transition"
              >
                {other.type === 'CORRECT_SCORE' ? '👉 玩比分波胆' : '👉 玩胜平负'}
              </a>
            ))}
          </div>
        </div>
      )}

        <BetPanel
          market={{
            id: market.id,
            title: displayTitle,
            status: market.status,
            totalStake: market.totalStake,
            rakeBps: market.rakeBps,
            winningKey: market.winningKey,
            options: market.options.map((o) => ({
              id: o.id,
              key: o.key,
              label: getOptionLabel(o),
              totalStake: o.totalStake,
              betCount: o.betCount,
            })),
          }}
        loggedIn={!!user}
        balance={user?.balanceUsdt || '0'}
      />

      {myBets.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">我在此市场的下注</h2>
          <div className="space-y-2">
            {myBets.map((b) => (
              <div key={b.id} className="card flex justify-between items-center">
                <div>
                  <div className="font-medium">{getOptionLabel(b.option)}</div>
                  <div className="text-xs opacity-60 mt-1">
                    <LocalTime date={b.createdAt} locale={locale} />
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>{Number(b.amount).toFixed(2)} U</div>
                  <div className="mt-1">
                    {b.status === 'ACTIVE' && <span className="tag">待开奖</span>}
                    {b.status === 'WON' && (
                      <span className="tag tag-green">
                        中奖 +{Number(b.payout || 0).toFixed(2)} U
                      </span>
                    )}
                    {b.status === 'LOST' && <span className="tag tag-red">未中</span>}
                    {b.status === 'VOIDED' && <span className="tag tag-muted">退款</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
