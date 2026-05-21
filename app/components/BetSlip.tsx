'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Selection = {
  marketId: string;
  marketTitle: string;
  optionId: string;
  optionLabel: string;
  odds: string;
};

export default function BetSlip() {
  const router = useRouter();
  const [selections, setSelections] = useState<Selection[]>([]);
  const [amount, setAmount] = useState('10');
  const [isOpen, setIsOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 从 localStorage 中恢复缓存的串关单
  useEffect(() => {
    const saved = localStorage.getItem('parlay_slip');
    if (saved) {
      try {
        setSelections(JSON.parse(saved));
      } catch (e) {}
    }

    const handleAdd = (e: Event) => {
      const customEvent = e as CustomEvent<Selection>;
      const newSel = customEvent.detail;

      setSelections((prev) => {
        // 1. 同一选项防重
        if (prev.some((s) => s.optionId === newSel.optionId)) {
          alert('该选项已在串关单中！');
          return prev;
        }

        // 2. 升级商业规则：允许单场选择多个选项（多选），并在结算时自动拆单
        const updated = [...prev, newSel];
        localStorage.setItem('parlay_slip', JSON.stringify(updated));
        setIsOpen(true); // 自动展开串关单
        return updated;
      });
    };

    window.addEventListener('parlay-add', handleAdd);
    return () => {
      window.removeEventListener('parlay-add', handleAdd);
    };
  }, []);

  const removeSelection = (optionId: string) => {
    const updated = selections.filter((s) => s.optionId !== optionId);
    setSelections(updated);
    localStorage.setItem('parlay_slip', JSON.stringify(updated));
  };

  const clearSlip = () => {
    setSelections([]);
    localStorage.removeItem('parlay_slip');
    setMsg('');
  };

  // ==========================================
  // 核心拆单计算：根据比赛分组，计算笛卡尔积组合
  // ==========================================
  const getMatchPrefix = (title: string) => {
    return title.split('-')[0].trim();
  };

  // 按比赛对阵分组
  const groups: { [match: string]: Selection[] } = {};
  selections.forEach((s) => {
    const matchKey = getMatchPrefix(s.marketTitle);
    if (!groups[matchKey]) {
      groups[matchKey] = [];
    }
    groups[matchKey].push(s);
  });

  const groupKeys = Object.keys(groups);

  // 计算笛卡尔积生成的组合票列表
  const tickets = (() => {
    if (groupKeys.length < 2) return [];
    const lists = Object.values(groups);
    
    return lists.reduce<Selection[][]>((a, b) => {
      const r: Selection[][] = [];
      a.forEach((x) => {
        b.forEach((y) => {
          r.push([...x, y]);
        });
      });
      return r;
    }, [[]]);
  })();

  // 计算多张组合票的总注数
  const ticketCount = tickets.length;

  // 计算投注所需的总本金
  const totalCost = (Number(amount) * ticketCount).toFixed(2);

  // 计算最高可能获得的返还奖金 (Max Payout)
  const maxPayout = (() => {
    if (tickets.length === 0) return '0.00';
    let maxOdds = 0;
    tickets.forEach((t) => {
      const oddsProd = t.reduce((acc, s) => acc * Number(s.odds), 1);
      // 将单张组合票的总赔率取 2 位小数四舍五入，以和界面显示的总赔率及后台派彩完全对齐一致
      const roundedOdds = Number(oddsProd.toFixed(2));
      if (roundedOdds > maxOdds) {
        maxOdds = roundedOdds;
      }
    });
    return (Number(amount) * maxOdds).toFixed(2);
  })();

  // 计算简易的总赔率范围或赔率显示
  const totalOddsDisplay = (() => {
    if (tickets.length === 0) return '0.00';
    if (tickets.length === 1) {
      return tickets[0].reduce((acc, s) => acc * Number(s.odds), 1).toFixed(2);
    }
    let minOdds = Infinity;
    let maxOdds = -Infinity;
    tickets.forEach((t) => {
      const o = t.reduce((acc, s) => acc * Number(s.odds), 1);
      if (o < minOdds) minOdds = o;
      if (o > maxOdds) maxOdds = o;
    });
    return `${minOdds.toFixed(2)} ~ ${maxOdds.toFixed(2)}`;
  })();

  // ==========================================
  // UI 渲染归类：将相同 marketId 的选项归并成一张卡片展示
  // ==========================================
  const groupedSelections: {
    [marketId: string]: {
      marketTitle: string;
      options: {
        optionId: string;
        optionLabel: string;
        odds: string;
      }[];
    };
  } = {};

  selections.forEach((s) => {
    if (!groupedSelections[s.marketId]) {
      groupedSelections[s.marketId] = {
        marketTitle: s.marketTitle,
        options: [],
      };
    }
    groupedSelections[s.marketId].options.push({
      optionId: s.optionId,
      optionLabel: s.optionLabel,
      odds: s.odds,
    });
  });

  const handleSubmit = async () => {
    if (groupKeys.length < 2) {
      setMsg('⚠️ 串关投注必须选择至少 2 场不同的比赛！');
      return;
    }
    setSubmitting(true);
    setMsg('');

    try {
      let successCount = 0;
      for (const t of tickets) {
        const res = await fetch('/api/bets/parlay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            selections: t.map((s) => ({
              marketId: s.marketId,
              optionId: s.optionId,
            })),
          }),
        });

        const json = await res.json();
        if (json.ok) {
          successCount++;
        } else {
          setMsg(`部分组合下注失败: ${json.error || '余额不足'}`);
          setSubmitting(false);
          return;
        }
      }

      setMsg(`🎉 成功下注 ${successCount} 注串关组合！`);
      setTimeout(() => {
        clearSlip();
        setIsOpen(false);
        router.refresh();
      }, 1500);
    } catch (e) {
      setSubmitting(false);
      setMsg('网络异常，请稍后再试');
    }
  };

  const isSelectionEmpty = selections.length === 0;
  if (isSelectionEmpty) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 浮动触发徽章 */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-sky-600 text-white rounded-full p-4 shadow-2xl flex items-center gap-2 hover:bg-sky-700 transition transform hover:scale-105 active:scale-95 animate-fade-in"
        >
          <span className="text-xl">🎟️</span>
          <span className="font-bold text-sm">串关单 ({selections.length})</span>
          {ticketCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 animate-pulse">
              {ticketCount}注
            </span>
          )}
        </button>
      ) : (
        /* 展开购物车面板 */
        <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-5 shadow-2xl w-80 md:w-96 flex flex-col max-h-[500px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎟️</span>
              <span className="font-bold text-sm">串关投注单 ({selections.length})</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearSlip}
                className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1"
              >
                清空
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 hover:text-white font-bold px-2 py-1"
              >
                ❌
              </button>
            </div>
          </div>

          {/* 选项归纳列表 */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
            {Object.entries(groupedSelections).map(([marketId, group]) => (
              <div
                key={marketId}
                className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-2.5 hover:border-slate-600 transition"
              >
                {/* 玩法对阵名称 */}
                <div className="text-[10px] text-sky-400 font-black border-b border-slate-750 pb-1.5 truncate">
                  ⚽ {group.marketTitle}
                </div>
                
                {/* 该场下选中的多个互斥选项列表 */}
                <div className="space-y-2">
                  {group.options.map((opt) => (
                    <div
                      key={opt.optionId}
                      className="flex items-center justify-between text-xs font-semibold text-slate-200 pl-1 hover:text-white transition"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeSelection(opt.optionId)}
                          className="text-slate-500 hover:text-red-400 font-black transition text-xs select-none"
                          title="移除该选项"
                        >
                          ✕
                        </button>
                        <span>{opt.optionLabel}</span>
                      </div>
                      <span className="text-amber-400 font-bold bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/50">
                        @{opt.odds}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 计费和下注 */}
          <div className="border-t border-slate-700 pt-3 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">选择场次</span>
                <span className="text-white font-semibold">{groupKeys.length} 场</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">拆分注数</span>
                <span className="text-white font-semibold">{ticketCount} 注</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">总赔率范围</span>
                <span className="text-amber-400 font-bold">{totalOddsDisplay} 倍</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-slate-400 block mb-1">
                  单注本金 (USDT)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  min="1"
                  step="1"
                />
              </div>
              <div className="flex-1 text-right">
                <div className="text-[10px] text-slate-400 mb-0.5">最高预计可返还</div>
                <div className="text-sm font-bold text-emerald-400 truncate">
                  {maxPayout} U
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || ticketCount === 0}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg transition active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? '提交下注中...'
                : ticketCount === 0
                ? '请选择至少 2 场比赛'
                : `立即下注 (共 ${totalCost} U)`}
            </button>

            {msg && (
              <div className="text-xs text-center font-semibold mt-2 text-rose-400 bg-rose-950/20 border border-rose-950 py-1.5 rounded-lg">
                {msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
