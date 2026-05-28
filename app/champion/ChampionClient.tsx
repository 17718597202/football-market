'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { estimateOdds } from '@/lib/odds';
import LocalTime from '@/components/LocalTime';

const FLAG_MAP: Record<string, string> = {
  ARGENTINA: '🇦🇷',
  FRANCE: '🇫🇷',
  BRAZIL: '🇧🇷',
  ENGLAND: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  SPAIN: '🇪🇸',
  GERMANY: '🇩🇪',
  PORTUGAL: '🇵🇹',
  NETHERLANDS: '🇳🇱',
  ITALY: '🇮🇹',
  BELGIUM: '🇧🇪',
  URUGUAY: '🇺🇾',
  CROATIA: '🇭🇷',
  JAPAN: '🇯🇵',
  USA: '🇺🇸',
  MEXICO: '🇲🇽',
  OTHER: '🏳️',
};

const TEAM_NAME_EN: Record<string, string> = {
  ARGENTINA: 'Argentina',
  FRANCE: 'France',
  BRAZIL: 'Brazil',
  ENGLAND: 'England',
  SPAIN: 'Spain',
  GERMANY: 'Germany',
  PORTUGAL: 'Portugal',
  NETHERLANDS: 'Netherlands',
  ITALY: 'Italy',
  BELGIUM: 'Belgium',
  URUGUAY: 'Uruguay',
  CROATIA: 'Croatia',
  JAPAN: 'Japan',
  USA: 'USA',
  MEXICO: 'Mexico',
  OTHER: 'Other Teams',
};

type Option = {
  id: string;
  key: string;
  label: string;
  totalStake: string;
  betCount: number;
};

type SettleBet = {
  id: string;
  amount: string;
  status: string;
  payout: string | null;
  createdAt: string;
  optionLabel: string;
  optionKey: string;
};

export default function ChampionClient({
  market,
  loggedIn,
  balance,
  myBets,
  locale,
  dict,
}: {
  market: {
    id: string;
    title: string;
    description: string;
    status: string;
    totalStake: string;
    rakeBps: number;
    winningKey: string | null;
    lockAt: string;
    options: Option[];
  };
  loggedIn: boolean;
  balance: string;
  myBets: SettleBet[];
  locale: string;
  dict: any;
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [amount, setAmount] = useState('50');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalStake = Number(market.totalStake);
  const isOpen = market.status === 'OPEN';

  // 排序：根据下注总量降序排序，用来在页面展示 Top Contenders 皇冠标识
  const sortedOptions = useMemo(() => {
    return [...market.options].sort((a, b) => Number(b.totalStake) - Number(a.totalStake));
  }, [market.options]);

  const selectedOption = useMemo(() => {
    return market.options.find((o) => o.key === selectedKey);
  }, [selectedKey, market.options]);

  const odds = useMemo(() => {
    if (!selectedKey || !amount || Number(amount) <= 0)
      return { impliedOdds: '—', estimatedPayout: '—' };
    return estimateOdds(
      market.totalStake,
      market.options.map((o) => ({ key: o.key, stake: o.totalStake })),
      selectedKey,
      amount,
      market.rakeBps
    );
  }, [selectedKey, amount, market]);

  async function placeBet() {
    if (!selectedKey) {
      setMsg(locale === 'zh' ? '请选择一个国家' : 'Please select a country');
      return;
    }
    const val = Number(amount);
    if (isNaN(val) || val <= 0) {
      setMsg(locale === 'zh' ? '请输入有效的投注金额' : 'Please enter a valid amount');
      return;
    }
    if (loggedIn && val > Number(balance)) {
      setMsg(locale === 'zh' ? '可用余额不足' : 'Insufficient balance');
      return;
    }

    setSubmitting(true);
    setMsg('');
    try {
      const res = await fetch('/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: market.id, optionKey: selectedKey, amount }),
      });
      const json = await res.json();
      setSubmitting(false);
      if (!json.ok) {
        setMsg(json.error);
        return;
      }
      setMsg(locale === 'zh' ? '🎉 下注成功！预祝你预测成功！' : '🎉 Bet placed successfully! Best of luck!');
      setSelectedKey(null);
      router.refresh();
    } catch (err) {
      setSubmitting(false);
      setMsg(locale === 'zh' ? '系统繁忙，请稍后再试' : 'System busy, please try again later');
    }
  }

  const getTeamLabel = (key: string, label: string) => {
    if (locale === 'zh') return label;
    return TEAM_NAME_EN[key] || label;
  };

  const quickAmounts = ['10', '50', '100', '500'];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 2026 World Cup Champion Hero Header */}
      <section className="relative rounded-3xl overflow-hidden p-8 border border-[rgba(234,179,8,0.2)] bg-gradient-to-br from-[rgba(15,23,42,0.8)] via-[rgba(25,18,5,0.7)] to-[rgba(15,23,42,0.85)] shadow-[0_15px_35px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-radial-gradient from-[rgba(234,179,8,0.15)] to-transparent pointer-events-none rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[rgba(234,179,8,0.1)] text-[#eab308] text-xs font-bold uppercase tracking-wider border border-[rgba(234,179,8,0.2)]">
              ✨ FIFA World Cup 2026
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fef08a] via-[#eab308] to-[#ca8a04] drop-shadow-sm">
                {locale === 'zh' ? '2026年世界杯冠军预测' : '2026 World Cup Champion Prediction'}
              </span>
            </h1>
            <p className="opacity-80 text-sm md:text-base leading-relaxed">
              {locale === 'zh' 
                ? '美加墨世界杯巅峰对决！用 USDT 支持你心仪的国家队。基于去中心化透明彩池模式，结算时所有赢家共同瓜分总奖金池！'
                : 'The pinnacle of football in USA, Canada & Mexico! Support your favorite nation with USDT. Winners dynamically split the complete prize pool!'}
            </p>
            <div className="flex flex-wrap gap-4 pt-2 justify-center md:justify-start text-xs opacity-60">
              <div>{locale === 'zh' ? '锁单时间：' : 'Locks at: '} <LocalTime date={new Date(market.lockAt)} locale={locale} /></div>
            </div>
          </div>

          {/* Golden Trophy Pool Display */}
          <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(234,179,8,0.3)] rounded-2xl p-6 text-center shadow-lg min-w-[220px] backdrop-blur-lg">
            <div className="text-4xl mb-2 animate-bounce">🏆</div>
            <div className="text-xs uppercase tracking-widest opacity-60 font-semibold">{locale === 'zh' ? '总预测彩池' : 'TOTAL PRIZE POOL'}</div>
            <div className="text-3xl font-black mt-1 text-[#10b981] drop-shadow-md">
              {totalStake.toFixed(2)} <span className="text-lg font-bold">U</span>
            </div>
            <div className="text-[10px] opacity-40 mt-1">{locale === 'zh' ? '彩池随每一次下注实时增长' : 'Pool grows in real-time with bets'}</div>
          </div>
        </div>
      </section>

      {/* Main Grid and Bet Slip Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Contenders Selection Grid (Left 2 columns on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#eab308] rounded-full shadow-[0_0_10px_rgba(234,179,8,0.6)]"></div>
            <h2 className="text-xl font-bold">{locale === 'zh' ? '诸强预测盘口' : 'National Contenders'}</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {market.options.map((o) => {
              const pct = totalStake > 0 ? (Number(o.totalStake) / totalStake) * 100 : 0;
              const isSel = selectedKey === o.key;
              const isWinner = market.winningKey === o.key;
              const rank = sortedOptions.findIndex((so) => so.key === o.key) + 1;
              const flag = FLAG_MAP[o.key] || '🏳️';

              // 计算当前估计赔率 (若池子为空，显示默认)
              const curOdds = (() => {
                const t = Number(market.totalStake);
                const st = Number(o.totalStake);
                if (t <= 0 || st <= 0) return '—';
                const rake = 1 - market.rakeBps / 10000;
                const val = (t * rake) / st;
                return val < 1.01 ? '1.01' : val.toFixed(2);
              })();

              return (
                <button
                  key={o.id}
                  disabled={!isOpen}
                  onClick={() => setSelectedKey(o.key)}
                  className={`group relative text-left p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between min-h-[150px] ${
                    isSel
                      ? 'border-[#eab308] bg-[rgba(234,179,8,0.1)] shadow-[0_0_20px_rgba(234,179,8,0.15)] scale-[1.02]'
                      : 'border-[var(--border)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(234,179,8,0.5)] hover:bg-[rgba(255,255,255,0.04)] hover:scale-[1.01]'
                  } ${isOpen ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'}`}
                >
                  {/* Top Contender Badges */}
                  {rank <= 3 && totalStake > 0 && (
                    <span className="absolute top-2 right-2 text-[10px] bg-gradient-to-r from-[#ca8a04] to-[#fef08a] text-black font-extrabold px-1.5 py-0.5 rounded-full shadow-sm">
                      👑 Top {rank}
                    </span>
                  )}

                  {/* Flag & Team Name */}
                  <div className="space-y-2">
                    <div className="text-3xl transition-transform group-hover:scale-110 duration-300">{flag}</div>
                    <div className="font-bold text-base md:text-lg group-hover:text-[#fef08a] transition-colors line-clamp-1">
                      {getTeamLabel(o.key, o.label)}
                    </div>
                  </div>

                  {/* Stats and Odds */}
                  <div className="space-y-1.5 mt-4">
                    <div className="flex items-center justify-between text-xs opacity-60">
                      <span>{Number(o.totalStake).toFixed(0)} U</span>
                      <span className="font-medium">{pct.toFixed(1)}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#eab308] to-[#fef08a] transition-all duration-500"
                        style={{ width: `${pct || 1}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[rgba(255,255,255,0.05)]">
                      <span className="opacity-50">{locale === 'zh' ? '预估赔率' : 'Est. Odds'}</span>
                      <span className={`font-bold ${curOdds !== '—' ? 'text-[#10b981]' : 'opacity-40'}`}>
                        {curOdds}
                      </span>
                    </div>
                  </div>

                  {isWinner && (
                    <div className="absolute inset-0 bg-[rgba(16,185,129,0.15)] border border-[#10b981] rounded-2xl flex items-center justify-center font-bold text-[#10b981] text-lg backdrop-blur-xs">
                      🏆 WINNER
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Bet Slip (Right 1 column on desktop) */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-[#10b981] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
            <h2 className="text-xl font-bold">{locale === 'zh' ? '锁定你的预测' : 'Champion Bet Slip'}</h2>
          </div>

          <div className="card border border-[rgba(255,255,255,0.06)] bg-[rgba(15,23,42,0.5)] backdrop-blur-md p-6 rounded-2xl space-y-6">
            {!isOpen ? (
              <div className="text-center py-8 space-y-2 opacity-60">
                <div className="text-3xl">🔒</div>
                <div className="font-bold">{locale === 'zh' ? '投注已关闭' : 'Prediction Closed'}</div>
                <p className="text-xs">{locale === 'zh' ? '世界杯已决出冠军或市场已被锁定。' : 'World cup has concluded or market is locked.'}</p>
              </div>
            ) : !selectedKey ? (
              <div className="text-center py-12 space-y-3 opacity-60 border-2 border-dashed border-[rgba(255,255,255,0.06)] rounded-xl">
                <div className="text-4xl animate-pulse">👉</div>
                <p className="text-sm font-medium">{locale === 'zh' ? '在左侧点击你想支持的国家队' : 'Click a country on the left to start'}</p>
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {/* Selected Team Card */}
                <div className="p-4 rounded-xl bg-[rgba(234,179,8,0.06)] border border-[rgba(234,179,8,0.2)] flex items-center gap-4">
                  <div className="text-4xl">{FLAG_MAP[selectedKey]}</div>
                  <div>
                    <div className="text-xs opacity-60 font-medium uppercase tracking-wider">{locale === 'zh' ? '你已选择' : 'YOU SELECTED'}</div>
                    <div className="text-lg font-extrabold text-[#fef08a]">{getTeamLabel(selectedKey, selectedOption?.label || '')}</div>
                  </div>
                  <button className="ml-auto text-xs opacity-50 hover:opacity-100 font-bold" onClick={() => setSelectedKey(null)}>
                    {locale === 'zh' ? '重选' : 'Clear'}
                  </button>
                </div>

                {/* Amount Inputs */}
                <div className="space-y-2.5">
                  <label className="text-sm opacity-80 block font-medium">{locale === 'zh' ? '投注金额 (USDT)' : 'Bet Amount (USDT)'}</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="input w-full pr-12 text-lg font-bold"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="1"
                      step="1"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm opacity-60 font-bold">USDT</span>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {quickAmounts.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(q)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-bold border transition ${
                          amount === q
                            ? 'bg-[#eab308] border-[#eab308] text-black'
                            : 'bg-transparent border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.03)]'
                        }`}
                      >
                        +{q}
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between text-xs pt-1">
                    <span className="opacity-60">{locale === 'zh' ? '可用余额：' : 'Wallet Balance: '}</span>
                    <span className="font-bold text-yellow-400">{Number(balance).toFixed(2)} U</span>
                  </div>
                </div>

                {/* Calculations Preview */}
                <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="opacity-60">{locale === 'zh' ? '预估决算赔率：' : 'Estimated Odds: '}</span>
                    <span className="font-bold text-[#10b981]">{odds.impliedOdds} x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-60">{locale === 'zh' ? '预测正确预计返还：' : 'Estimated Return: '}</span>
                    <span className="font-extrabold text-[#10b981]">{odds.estimatedPayout} USDT</span>
                  </div>
                  <p className="opacity-50 text-[10px] leading-relaxed pt-1.5 border-t border-[rgba(255,255,255,0.05)]">
                    {locale === 'zh'
                      ? '※ 注：彩池赔率非固定。你获得的奖金最终取决于结算时你所下注队伍在获胜池中的金额占比。'
                      : '※ Pari-mutuel odds are not fixed. Your final return will depend on your share of the winning team pool upon settlement.'}
                  </p>
                </div>

                {/* Action button */}
                {!loggedIn ? (
                  <a href="/login" className="btn w-full block text-center font-bold no-underline py-3">
                    🔑 {locale === 'zh' ? '请先登录' : 'Please Log In'}
                  </a>
                ) : (
                  <button
                    onClick={placeBet}
                    disabled={submitting}
                    className="btn btn-success w-full font-bold py-3 text-base shadow-[0_0_20px_rgba(16,185,129,0.3)] select-none hover:scale-101 active:scale-99 transition-all duration-250 cursor-pointer"
                  >
                    🚀 {submitting ? (locale === 'zh' ? '下注提交中...' : 'Submitting...') : (locale === 'zh' ? `确认支持 ${getTeamLabel(selectedKey, selectedOption?.label || '')}` : `Confirm Wager`)}
                  </button>
                )}

                {msg && (
                  <div className={`p-3 rounded-lg text-xs font-semibold ${msg.includes('成功') || msg.includes('successfully') ? 'bg-[rgba(16,185,129,0.15)] text-[#10b981]' : 'bg-[rgba(239,68,68,0.15)] text-[#ef4444]'}`}>
                    {msg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* User's Champion Bets History Section */}
      <section className="mt-12 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-[#eab308] rounded-full shadow-[0_0_10px_rgba(234,179,8,0.6)]"></div>
          <h2 className="text-xl font-bold">{locale === 'zh' ? '我的夺冠预测单' : 'My Champion Predictions'}</h2>
        </div>

        {myBets.length === 0 ? (
          <div className="card text-center py-12 opacity-50 border-dashed">
            🔮 {locale === 'zh' ? '你目前还没有做出夺冠预测。立即支持心仪的国家队，瓜分巨额奖池！' : 'You haven\'t made any predictions yet. Support your favorite team today!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myBets.map((b) => (
              <div key={b.id} className="card relative overflow-hidden group border border-[rgba(255,255,255,0.04)] bg-[rgba(15,23,42,0.3)] hover:border-[rgba(234,179,8,0.3)] transition-all p-5 flex justify-between items-center rounded-2xl">
                <div className="flex items-center gap-3.5">
                  <div className="text-4xl">{FLAG_MAP[b.optionKey] || '🏳️'}</div>
                  <div>
                    <div className="font-extrabold text-lg text-white group-hover:text-[#fef08a] transition-colors">{getTeamLabel(b.optionKey, b.optionLabel)}</div>
                    <div className="text-xs opacity-50 mt-1 flex items-center gap-2">
                      <LocalTime date={new Date(b.createdAt)} locale={locale} />
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <div className="font-bold text-white text-base">{Number(b.amount).toFixed(2)} USDT</div>
                  <div>
                    {b.status === 'ACTIVE' && (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[rgba(234,179,8,0.1)] text-[#eab308] text-xs font-bold border border-[rgba(234,179,8,0.2)] animate-pulse">
                        {locale === 'zh' ? '待决赛开盘' : 'Active Pool'}
                      </span>
                    )}
                    {b.status === 'WON' && (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.15)] text-[#10b981] text-xs font-extrabold border border-[rgba(16,185,129,0.2)] shadow-sm">
                        🏆 {locale === 'zh' ? `中奖 +${Number(b.payout || 0).toFixed(2)} U` : `Won +${Number(b.payout || 0).toFixed(2)} U`}
                      </span>
                    )}
                    {b.status === 'LOST' && (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] text-gray-500 text-xs font-semibold">
                        {locale === 'zh' ? '预测落空' : 'Lost'}
                      </span>
                    )}
                    {b.status === 'VOIDED' && (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full bg-[rgba(239,68,68,0.1)] text-[#ef4444] text-xs font-semibold">
                        {locale === 'zh' ? '全额退款' : 'Refunded'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
