'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  user: { balance: string; frozen: string; tronAddress: string | null };
  hotWallet: string;
  minWithdraw: string;
  transactions: any[];
  withdrawals: any[];
};

export default function WalletClient({
  user,
  hotWallet,
  minWithdraw,
  transactions,
  withdrawals,
}: Props) {
  const router = useRouter();
  const [tronAddr, setTronAddr] = useState(user.tronAddress || '');
  const [wdAddr, setWdAddr] = useState(user.tronAddress || '');
  const [wdAmount, setWdAmount] = useState('');
  const [msg, setMsg] = useState('');

  async function bind() {
    setMsg('');
    const r = await fetch('/api/wallet/bind-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tronAddress: tronAddr }),
    });
    const j = await r.json();
    if (!j.ok) setMsg('绑定失败: ' + j.error);
    else {
      setMsg('绑定成功');
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
    if (!j.ok) setMsg('提现失败: ' + j.error);
    else {
      setMsg('提现申请已提交，等待审核');
      setWdAmount('');
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">钱包</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm opacity-60">可用余额</div>
          <div className="text-3xl font-bold mt-1">
            {Number(user.balance).toFixed(2)} <span className="text-base opacity-60">U</span>
          </div>
        </div>
        <div className="card">
          <div className="text-sm opacity-60">提现冻结</div>
          <div className="text-3xl font-bold mt-1">
            {Number(user.frozen).toFixed(2)} <span className="text-base opacity-60">U</span>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">充值（TRC20 USDT）</h2>
        <div className="text-sm opacity-80">
          1. 把你的 TRC20 转出地址绑定到账号（仅来自该地址的充值会自动入账）
          <br />
          2. 把 USDT 转入平台收款地址
          <br />
          3. 区块链确认后自动到账（一般 1-3 分钟）
        </div>
        <div>
          <label className="text-sm opacity-70 block mb-1">我的 TRC20 转出地址</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={tronAddr}
              onChange={(e) => setTronAddr(e.target.value)}
              placeholder="T 开头的 Tron 地址"
            />
            <button className="btn" onClick={bind}>
              绑定
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm opacity-70 block mb-1">平台收款地址（请精确复制）</label>
          <div className="input font-mono select-all break-all">{hotWallet}</div>
        </div>
        <div className="text-xs opacity-60">
          注：必须 TRC20-USDT；ERC20/BEP20 一律不会到账并无法找回
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">提现</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm opacity-70 block mb-1">收款地址</label>
            <input
              className="input"
              value={wdAddr}
              onChange={(e) => setWdAddr(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm opacity-70 block mb-1">
              金额（最低 {minWithdraw} U）
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
          申请提现
        </button>
        <div className="text-xs opacity-60">提现需管理员审核后链上发送</div>
      </div>

      {msg && <div className="card text-sm">{msg}</div>}

      <div>
        <h2 className="font-bold mb-3">提现记录</h2>
        <div className="space-y-2">
          {withdrawals.length === 0 && (
            <div className="card text-center opacity-60 text-sm">暂无</div>
          )}
          {withdrawals.map((w) => (
            <div key={w.id} className="card flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{Number(w.amount).toFixed(2)} U</div>
                <div className="text-xs opacity-60 font-mono break-all mt-1">
                  → {w.toAddress}
                </div>
                <div className="text-xs opacity-60 mt-1">
                  {new Date(w.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="text-right">
                <StatusTag s={w.status} />
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
        <h2 className="font-bold mb-3">最近流水</h2>
        <div className="space-y-1 text-sm">
          {transactions.length === 0 && (
            <div className="card text-center opacity-60">暂无</div>
          )}
          {transactions.map((t) => (
            <div key={t.id} className="card flex justify-between items-center">
              <div>
                <div className="font-medium">{txTypeLabel(t.type)}</div>
                <div className="text-xs opacity-60 mt-0.5">{t.remark}</div>
                <div className="text-xs opacity-60 mt-0.5">
                  {new Date(t.createdAt).toLocaleString('zh-CN')}
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

function StatusTag({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    PENDING: ['tag-yellow', '待审核'],
    APPROVED: ['tag', '已批准'],
    SENT: ['tag-green', '已发送'],
    REJECTED: ['tag-red', '已驳回'],
    FAILED: ['tag-red', '失败'],
  };
  const [cls, txt] = map[s] || ['tag-muted', s];
  return <span className={`tag ${cls}`}>{txt}</span>;
}

function txTypeLabel(t: string) {
  return (
    {
      DEPOSIT: '充值',
      WITHDRAW_LOCK: '提现锁定',
      WITHDRAW_RELEASE: '提现完成',
      WITHDRAW_REFUND: '提现退回',
      BET_PLACE: '下注',
      BET_PAYOUT: '中奖',
      BET_REFUND: '退款',
      ADJUSTMENT: '调账',
    } as any
  )[t] || t;
}
