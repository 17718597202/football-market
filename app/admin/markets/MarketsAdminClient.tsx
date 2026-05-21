'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Market = any;

export default function MarketsAdminClient({ markets }: { markets: Market[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">市场管理</h1>
        <button className="btn" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? '收起' : '+ 新建市场'}
        </button>
      </div>
      {showCreate && <CreateMarketForm onDone={() => router.refresh()} />}
      <div className="space-y-2">
        {markets.map((m) => (
          <MarketRow key={m.id} m={m} onRefresh={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}

function MarketRow({ m, onRefresh }: { m: any; onRefresh: () => void }) {
  const [showSettle, setShowSettle] = useState(false);
  const [winner, setWinner] = useState(m.options[0]?.key || '');

  async function settle(voidIt = false) {
    const ok = confirm(
      voidIt
        ? '确认作废此市场？将全员退款。此操作不可逆。'
        : `确认结算？胜方 = ${winner}。此操作不可逆。`
    );
    if (!ok) return;
    const r = await fetch(`/api/admin/markets/${m.id}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winningKey: voidIt ? null : winner, voidMarket: voidIt }),
    });
    const j = await r.json();
    if (!j.ok) alert('结算失败: ' + j.error);
    else {
      alert(`完成：影响 ${j.data.affectedUsers} 用户`);
      onRefresh();
    }
  }

  async function lock() {
    const r = await fetch(`/api/admin/markets/${m.id}/lock`, { method: 'POST' });
    const j = await r.json();
    if (!j.ok) alert('锁定失败: ' + j.error);
    else onRefresh();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs opacity-60">
            {m.match.competition} · {m.id}
          </div>
          <div className="font-medium mt-0.5">{m.title}</div>
          <div className="text-xs opacity-60 mt-1">
            锁单 {new Date(m.lockAt).toLocaleString('zh-CN')} · 抽水 {m.rakeBps / 100}%
          </div>
          <div className="text-xs opacity-60 mt-1">
            奖池 {Number(m.totalStake).toFixed(2)} U · {m._count.bets} 笔下注
          </div>
        </div>
        <div className="text-right text-sm space-y-1">
          {m.status === 'OPEN' && <span className="tag tag-green">下注中</span>}
          {m.status === 'LOCKED' && <span className="tag tag-yellow">已锁定</span>}
          {m.status === 'RESOLVED' && <span className="tag tag-muted">已结算</span>}
          {m.status === 'VOIDED' && <span className="tag tag-red">已作废</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        {m.options.map((o: any) => (
          <div key={o.id} className="bg-[var(--border)]/30 rounded p-2">
            <div className="font-medium">{o.label}</div>
            <div className="opacity-60 mt-1">
              {Number(o.totalStake).toFixed(2)} U · {o.betCount} 注
            </div>
          </div>
        ))}
      </div>
      {(m.status === 'OPEN' || m.status === 'LOCKED') && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {m.status === 'OPEN' && (
            <button className="btn btn-secondary text-sm" onClick={lock}>
              锁定下注
            </button>
          )}
          <button
            className="btn btn-success text-sm"
            onClick={() => setShowSettle((v) => !v)}
          >
            {showSettle ? '收起' : '结算'}
          </button>
          <button className="btn btn-danger text-sm" onClick={() => settle(true)}>
            作废退款
          </button>
        </div>
      )}
      {showSettle && (
        <div className="mt-3 flex gap-2 items-center">
          <span className="text-sm opacity-70">胜出选项</span>
          <select
            className="input flex-1"
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
          >
            {m.options.map((o: any) => (
              <option key={o.id} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="btn btn-success" onClick={() => settle(false)}>
            确认结算
          </button>
        </div>
      )}
    </div>
  );
}

function CreateMarketForm({ onDone }: { onDone: () => void }) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [competition, setCompetition] = useState('Friendly');
  const [kickoff, setKickoff] = useState('');
  const [rake, setRake] = useState('300');
  const [msg, setMsg] = useState('');

  async function submit() {
    setMsg('');
    if (!home || !away || !kickoff) {
      setMsg('请填写完整');
      return;
    }
    const r = await fetch('/api/admin/markets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newMatch: { competition, homeTeam: home, awayTeam: away, kickoffAt: kickoff },
        type: 'RESULT_1X2',
        title: `${home} vs ${away} - 全场胜平负`,
        lockAt: kickoff,
        rakeBps: Number(rake),
        options: [
          { key: 'HOME', label: `${home} 胜` },
          { key: 'DRAW', label: '平局' },
          { key: 'AWAY', label: `${away} 胜` },
        ],
      }),
    });
    const j = await r.json();
    if (!j.ok) setMsg('失败: ' + j.error);
    else {
      setHome('');
      setAway('');
      setKickoff('');
      onDone();
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">新建市场（胜平负）</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs opacity-70 block mb-1">联赛</label>
          <input
            className="input"
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs opacity-70 block mb-1">开赛时间 (本地)</label>
          <input
            type="datetime-local"
            className="input"
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs opacity-70 block mb-1">主队</label>
          <input className="input" value={home} onChange={(e) => setHome(e.target.value)} />
        </div>
        <div>
          <label className="text-xs opacity-70 block mb-1">客队</label>
          <input className="input" value={away} onChange={(e) => setAway(e.target.value)} />
        </div>
        <div>
          <label className="text-xs opacity-70 block mb-1">抽水基点 (100=1%)</label>
          <input
            className="input"
            value={rake}
            onChange={(e) => setRake(e.target.value)}
          />
        </div>
      </div>
      <button className="btn" onClick={submit}>
        创建
      </button>
      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
