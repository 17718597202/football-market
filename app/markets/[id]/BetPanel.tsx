'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { estimateOdds } from '@/lib/odds';

type Option = {
  id: string;
  key: string;
  label: string;
  totalStake: string;
  betCount: number;
};

export default function BetPanel({
  market,
  loggedIn,
  balance,
}: {
  market: {
    id: string;
    title: string;
    status: string;
    totalStake: string;
    rakeBps: number;
    winningKey: string | null;
    options: Option[];
  };
  loggedIn: boolean;
  balance: string;
}) {
  const router = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [amount, setAmount] = useState('10');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      setMsg('请选择一个选项');
      return;
    }
    setSubmitting(true);
    setMsg('');
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
    setMsg('下注成功！');
    router.refresh();
  }

  const totalStake = Number(market.totalStake);
  const isOpen = market.status === 'OPEN';

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-4">选项</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {market.options.map((o) => {
          const pct = totalStake > 0 ? (Number(o.totalStake) / totalStake) * 100 : 0;
          const isSel = selectedKey === o.key;
          const isWinner = market.winningKey === o.key;
          return (
            <button
              key={o.id}
              disabled={!isOpen}
              onClick={() => setSelectedKey(o.key)}
              className={
                'text-left p-4 rounded-lg border transition relative ' +
                (isSel
                  ? 'border-[var(--brand)] bg-[rgba(14,165,233,.08)]'
                  : 'border-[var(--border)] bg-transparent hover:border-[var(--brand)]') +
                (isOpen ? ' cursor-pointer' : ' opacity-60 cursor-not-allowed')
              }
            >
              <div className="font-medium flex items-center justify-between">
                <span>{o.label}</span>
                <div className="flex items-center gap-1.5">
                  {isWinner && <span className="tag tag-green">胜出</span>}
                  {isOpen && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation(); // 阻止卡片点击事件
                        window.dispatchEvent(
                          new CustomEvent('parlay-add', {
                            detail: {
                              marketId: market.id,
                              marketTitle: market.title,
                              optionId: o.id,
                              optionLabel: o.label,
                              odds: (function () {
                                const t = Number(market.totalStake);
                                const st = Number(o.totalStake);
                                if (t <= 0 || st <= 0) return '1.85';
                                const rake = 1 - market.rakeBps / 10000;
                                const val = (t * rake) / st;
                                return val < 1.01 ? '1.01' : val.toFixed(2);
                              })(),
                            },
                          })
                        );
                      }}
                      className="text-[10px] bg-sky-600 hover:bg-sky-500 text-white font-bold px-1.5 py-0.5 rounded cursor-pointer transition select-none"
                    >
                      + 串关
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs opacity-60 mt-2">
                {Number(o.totalStake).toFixed(2)} U · {o.betCount} 注
              </div>
              <div className="text-xs opacity-60 mt-1">占比 {pct.toFixed(1)}%</div>
              <div className="h-1 rounded bg-[var(--border)] mt-2 overflow-hidden">
                <div
                  className="h-full bg-[var(--brand)]"
                  style={{ width: pct + '%' }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {isOpen && (
        <div className="mt-6 space-y-3">
          {!loggedIn ? (
            <div className="text-sm opacity-70">
              请先 <a href="/login">登录</a> 后下注
            </div>
          ) : (
            <>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm opacity-70 block mb-1">下注金额 (USDT)</label>
                  <input
                    type="number"
                    className="input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="1"
                    step="0.01"
                  />
                  <div className="text-xs opacity-60 mt-1">
                    可用余额 {Number(balance).toFixed(2)} U
                  </div>
                </div>
                <button
                  className="btn"
                  disabled={!selectedKey || submitting}
                  onClick={placeBet}
                >
                  {submitting ? '提交中...' : '下注'}
                </button>
              </div>
              <div className="text-xs opacity-70">
                如果该选项胜出，预估赔率 <b>{odds.impliedOdds}</b>，预估返还{' '}
                <b>{odds.estimatedPayout} U</b>（含本金）
                <br />
                注：彩池模式赔率会随后续下注变化，最终以结算时占比为准
              </div>
              {msg && <div className="text-sm">{msg}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
