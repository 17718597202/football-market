import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function MyBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const resolvedParams = await searchParams;
  const activeTab = resolvedParams.tab || 'single';

  // 1. 获取单场彩池下注
  const bets = await prisma.bet.findMany({
    where: { userId: user.id },
    include: {
      option: true,
      market: { include: { match: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // 2. 获取固定赔率串关下注
  const parlayBets = await prisma.parlayBet.findMany({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          market: { include: { match: true } },
          option: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // 3. 统计汇总 (结合单场与串关)
  let totalBet = 0;
  let totalWon = 0;
  let activeCount = 0;

  for (const b of bets) {
    totalBet += Number(b.amount);
    if (b.status === 'WON' || b.status === 'VOIDED') totalWon += Number(b.payout || 0);
    if (b.status === 'ACTIVE') activeCount++;
  }

  for (const p of parlayBets) {
    totalBet += Number(p.amount);
    if (p.status === 'WON' || p.status === 'VOIDED') totalWon += Number(p.payout || 0);
    if (p.status === 'ACTIVE') activeCount++;
  }

  const pnl = totalWon - totalBet;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">我的下注</h1>

      {/* 统计概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card text-center py-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs opacity-60">总下注本金</div>
          <div className="text-xl font-bold mt-1 text-white">{totalBet.toFixed(2)} U</div>
        </div>
        <div className="card text-center py-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs opacity-60">总中奖返还</div>
          <div className="text-xl font-bold mt-1 text-white">{totalWon.toFixed(2)} U</div>
        </div>
        <div className="card text-center py-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs opacity-60">净盈亏</div>
          <div
            className={
              'text-xl font-black mt-1 ' +
              (pnl >= 0 ? 'text-emerald-400' : 'text-rose-400')
            }
          >
            {pnl >= 0 ? '+' : ''}
            {pnl.toFixed(2)} U
          </div>
        </div>
        <div className="card text-center py-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="text-xs opacity-60">待开奖注数</div>
          <div className="text-xl font-bold mt-1 text-sky-400">{activeCount}</div>
        </div>
      </div>

      {/* 玩法 Tab 切换栏 */}
      <div className="flex gap-2 border-b border-slate-800 pb-px">
        <Link
          href="/me/bets?tab=single"
          className={
            'px-4 py-2 text-sm font-bold no-underline transition border-b-2 ' +
            (activeTab === 'single'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-white')
          }
        >
          单场彩池 ({bets.length})
        </Link>
        <Link
          href="/me/bets?tab=parlay"
          className={
            'px-4 py-2 text-sm font-bold no-underline transition border-b-2 ' +
            (activeTab === 'parlay'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-white')
          }
        >
          固定赔率串关 ({parlayBets.length})
        </Link>
      </div>

      {/* 列表渲染 */}
      <div className="space-y-3">
        {activeTab === 'single' ? (
          /* 单场彩池列表 */
          bets.length === 0 ? (
            <div className="card text-center opacity-60 bg-slate-900 border-slate-800 p-8 rounded-xl">
              暂无单场彩池投注记录
            </div>
          ) : (
            bets.map((b) => (
              <Link
                key={b.id}
                href={`/markets/${b.market.id}`}
                className="card flex items-center justify-between no-underline hover:border-slate-600 transition bg-slate-900 border border-slate-800 p-4 rounded-xl"
              >
                <div className="flex-1">
                  <div className="text-[10px] text-sky-400 font-bold">
                    {b.market.match.competition} · {b.market.match.homeTeam} vs{' '}
                    {b.market.match.awayTeam}
                  </div>
                  <div className="font-semibold text-sm text-white mt-1">
                    下注：{b.option.label}
                  </div>
                  <div className="text-[10px] opacity-50 mt-1">
                    下单时间：{new Date(b.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="text-right text-sm ml-4">
                  <div className="font-bold text-white">{Number(b.amount).toFixed(2)} U</div>
                  <div className="mt-1">
                    {b.status === 'ACTIVE' && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                        待开奖
                      </span>
                    )}
                    {b.status === 'WON' && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-850">
                        已中奖 +{Number(b.payout || 0).toFixed(2)} U
                      </span>
                    )}
                    {b.status === 'LOST' && (
                      <span className="text-[10px] bg-rose-950 text-rose-400 px-2 py-0.5 rounded border border-rose-850">
                        未中奖
                      </span>
                    )}
                    {b.status === 'VOIDED' && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                        退款
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )
        ) : (
          /* 固定赔率串关列表 */
          parlayBets.length === 0 ? (
            <div className="card text-center opacity-60 bg-slate-900 border-slate-800 p-8 rounded-xl">
              暂无串关投注记录
            </div>
          ) : (
            parlayBets.map((pb) => (
              <div
                key={pb.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 relative hover:border-slate-700 transition"
              >
                {/* 串关订单头部 */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                  <div>
                    <div className="text-[10px] text-amber-400 font-black">
                      🎟️ {pb.items.length} 串 1 串关投注单
                    </div>
                    <div className="text-[10px] opacity-50 mt-0.5">
                      订单号: {pb.id} · 下单时间: {new Date(pb.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-white">
                      总赔率: <span className="text-amber-400">{pb.odds}x</span>
                    </div>
                    <div className="text-[10px] opacity-60">
                      本金: {Number(pb.amount).toFixed(2)} U
                    </div>
                  </div>
                </div>

                {/* 串关 Leg 详情 */}
                <div className="space-y-2 pl-2 border-l border-slate-800">
                  {pb.items.map((item) => {
                    const match = item.market.match;
                    return (
                      <div key={item.id} className="flex justify-between items-center text-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="opacity-50 text-[10px] truncate">
                            {item.market.title}
                          </div>
                          <div className="font-medium text-slate-200 mt-0.5">
                            {match.homeTeam} vs {match.awayTeam}
                          </div>
                          <div className="font-semibold text-white">
                            选择: {item.option.label}{' '}
                            <span className="text-amber-400">@{item.odds}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {item.status === 'ACTIVE' && (
                            <span className="text-[10px] text-slate-500 font-bold">⏳ 待开赛</span>
                          )}
                          {item.status === 'WON' && (
                            <span className="text-[10px] text-emerald-400 font-bold">✅ 胜出</span>
                          )}
                          {item.status === 'LOST' && (
                            <span className="text-[10px] text-rose-500 font-bold">❌ 未中</span>
                          )}
                          {item.status === 'VOIDED' && (
                            <span className="text-[10px] text-slate-400 font-bold">➖ 作废(1.0x)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 结算底框 */}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
                  <span className="opacity-60">订单状态</span>
                  <div>
                    {pb.status === 'ACTIVE' && (
                      <span className="text-sky-400 font-bold bg-sky-950/40 px-2 py-0.5 rounded border border-sky-900">
                        进行中 (预计返还: {(Number(pb.amount) * Number(pb.odds)).toFixed(2)} U)
                      </span>
                    )}
                    {pb.status === 'WON' && (
                      <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900">
                        🎉 获胜 派彩 +{Number(pb.payout).toFixed(2)} U
                      </span>
                    )}
                    {pb.status === 'LOST' && (
                      <span className="text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900">
                        未中奖
                      </span>
                    )}
                    {pb.status === 'VOIDED' && (
                      <span className="text-slate-400 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        已退款 {Number(pb.payout).toFixed(2)} U
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
