'use client';
import { useState } from 'react';

const LEAGUES = [
  { code: 'PL', name: '英超 Premier League' },
  { code: 'PD', name: '西甲 La Liga' },
  { code: 'BL1', name: '德甲 Bundesliga' },
  { code: 'SA', name: '意甲 Serie A' },
  { code: 'FL1', name: '法甲 Ligue 1' },
  { code: 'CL', name: '欧冠 Champions League' },
  { code: 'EL', name: '欧联 Europa League' },
  { code: 'EC', name: '欧洲杯 European Championship' },
  { code: 'WC', name: '世界杯 World Cup' },
];

export default function SyncClient() {
  const today = new Date().toISOString().slice(0, 10);
  const next = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [comp, setComp] = useState('PL');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(next);
  const [autoCreate, setAutoCreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    const r = await fetch('/api/admin/sync-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competition: comp,
        dateFrom: from,
        dateTo: to,
        autoCreate1x2: autoCreate,
      }),
    });
    const j = await r.json();
    setBusy(false);
    setResult(j);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">同步赛程</h1>
      <div className="card space-y-3">
        <div className="text-sm opacity-70">
          从 football-data.org 拉取赛程，自动创建胜平负市场（已存在的跳过）
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs opacity-70 block mb-1">联赛</label>
            <select
              className="input"
              value={comp}
              onChange={(e) => setComp(e.target.value)}
            >
              {LEAGUES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="text-sm flex items-center gap-2 opacity-90">
              <input
                type="checkbox"
                checked={autoCreate}
                onChange={(e) => setAutoCreate(e.target.checked)}
              />
              自动创建胜平负市场
            </label>
          </div>
          <div>
            <label className="text-xs opacity-70 block mb-1">起始日期</label>
            <input
              type="date"
              className="input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs opacity-70 block mb-1">结束日期</label>
            <input
              type="date"
              className="input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <button className="btn" onClick={sync} disabled={busy}>
          {busy ? '同步中...' : '开始同步'}
        </button>
        {result && (
          <div className="text-sm bg-[var(--border)]/30 rounded p-3 mt-3 font-mono">
            {result.ok ? (
              <>
                共 {result.data.total} 场 · 新增 {result.data.created} · 更新{' '}
                {result.data.updated} · 自动创建市场 {result.data.marketsCreated}
              </>
            ) : (
              <span className="text-red-400">失败: {result.error}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
