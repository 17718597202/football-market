'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  user: { balance: string; frozen: string; bscAddress: string | null };
  hotWallet: string;
  minWithdraw: string;
  transactions: any[];
  withdrawals: any[];
  dict: any;
};

export default function WalletClient({
  user,
  hotWallet,
  minWithdraw,
  transactions,
  withdrawals,
  dict,
}: Props) {
  const router = useRouter();
  const [bscAddr, setBscAddr] = useState(user.bscAddress || '');
  const [wdAddr, setWdAddr] = useState(user.bscAddress || '');
  const [wdAmount, setWdAmount] = useState('');
  const [msg, setMsg] = useState('');

  async function bind() {
    setMsg('');
    const r = await fetch('/api/wallet/bind-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bscAddress: bscAddr }),
    });
    const j = await r.json();
    if (!j.ok) setMsg('Failed/失败: ' + j.error);
    else {
      setMsg('Success/成功');
      router.refresh();
    }
  }

  async function withdraw() {
    setMsg('');
    const r = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toAddress: wdAddr, amount: wdAmount }),
    });
    const j = await r.json();
    if (!j.ok) setMsg('Failed/失败: ' + j.error);
    else {
      setMsg('Submitted/已提交审核');
      setWdAmount('');
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{dict.title}</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm opacity-60">{dict.balance}</div>
          <div className="text-3xl font-bold mt-1">
            {Number(user.balance).toFixed(2)} <span className="text-base opacity-60">U</span>
          </div>
        </div>
        <div className="card">
          <div className="text-sm opacity-60">{dict.frozen}</div>
          <div className="text-3xl font-bold mt-1">
            {Number(user.frozen).toFixed(2)} <span className="text-base opacity-60">U</span>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">{dict.depositTitle}</h2>
        <div className="text-sm opacity-80">
          {dict.depositDesc1}
          <br />
          {dict.depositDesc2}
          <br />
          {dict.depositDesc3}
        </div>
        <div>
          <label className="text-sm opacity-70 block mb-1">{dict.myBscAddress}</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={bscAddr}
              onChange={(e) => setBscAddr(e.target.value)}
              placeholder={dict.placeholderBsc}
            />
            <button className="btn" onClick={bind}>
              {dict.bind}
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm opacity-70 block mb-1">{dict.platformAddress}</label>
          <div className="input font-mono select-all break-all">{hotWallet}</div>
        </div>
        <div className="text-xs opacity-60">
          {dict.depositNote}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">{dict.withdrawTitle}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-70 block mb-1">{dict.withdrawAddress}</label>
            <input
              className="input"
              value={wdAddr}
              onChange={(e) => setWdAddr(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-70 block mb-1">
              {dict.withdrawAmount.replace('{min}', minWithdraw)}
            </label>
            <input
              type="number"
              className="input"
              value={wdAmount}
              onChange={(e) => setWdAmount(e.target.value)}
              min={minWithdraw}
            />
          </div>
        </div>
        <button className="btn" onClick={withdraw}>
          {dict.withdrawSubmit}
        </button>
        <div className="text-xs opacity-60">{dict.withdrawNote}</div>
      </div>

      {msg && <div className="card text-sm">{msg}</div>}

      <div>
        <h2 className="font-bold mb-3">{dict.withdrawHistory}</h2>
        <div className="space-y-2">
          {withdrawals.length === 0 && (
            <div className="card text-center opacity-60 text-sm">{dict.noData}</div>
          )}
          {withdrawals.map((w) => (
            <div key={w.id} className="card flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{Number(w.amount).toFixed(2)} U</div>
                <div className="text-xs opacity-60 font-mono break-all mt-1">
                  → {w.toAddress}
                </div>
                <div className="text-xs opacity-60 mt-1">
                  {new Date(w.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <StatusTag s={w.status} dict={dict.status} />
                {w.txHash && (
                  <div className="text-xs opacity-60 mt-1 font-mono">
                    {w.txHash.slice(0, 10)}...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold mb-3">{dict.recentTx}</h2>
        <div className="space-y-1 text-sm">
          {transactions.length === 0 && (
            <div className="card text-center opacity-60">{dict.noData}</div>
          )}
          {transactions.map((t) => (
            <div key={t.id} className="card flex justify-between items-center">
              <div>
                <div className="font-medium">{dict.txType[t.type] || t.type}</div>
                <div className="text-xs opacity-60 mt-0.5">{t.remark}</div>
                <div className="text-xs opacity-60 mt-0.5">
                  {new Date(t.createdAt).toLocaleString()}
                </div>
              </div>
              <div
                className={
                  'font-mono ' +
                  (Number(t.amount) >= 0 ? 'text-green-400' : 'text-red-400')
                }
              >
                {Number(t.amount) >= 0 ? '+' : ''}
                {Number(t.amount).toFixed(2)} U
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusTag({ s, dict }: { s: string; dict: any }) {
  const map: Record<string, string> = {
    PENDING: 'tag-yellow',
    APPROVED: 'tag',
    SENT: 'tag-green',
    REJECTED: 'tag-red',
    FAILED: 'tag-red',
  };
  const cls = map[s] || 'tag-muted';
  const txt = dict[s] || s;
  return <span className={`tag ${cls}`}>{txt}</span>;
}
