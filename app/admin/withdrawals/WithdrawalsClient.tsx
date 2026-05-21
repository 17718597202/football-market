'use client';
import { useRouter } from 'next/navigation';

export default function WithdrawalsClient({ list }: { list: any[] }) {
  const router = useRouter();

  async function review(id: string, action: 'APPROVE' | 'REJECT') {
    let remark = '';
    let txHash = '';
    
    if (action === 'REJECT') {
      remark = prompt('请输入驳回原因：') || '';
      if (!confirm('确认驳回？资金将退回用户余额。')) return;
    } else {
      txHash = prompt('已手动完成链上转账？\n请在此粘贴交易哈希 (TxHash)，以确认已转账：') || '';
      if (!confirm('确认审批通过？这将扣除用户的冻结资金。')) return;
    }

    const r = await fetch(`/api/admin/withdrawals/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, remark, txHash }),
    });
    const j = await r.json();
    if (!j.ok) alert('失败: ' + j.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">提现审核</h1>
      <div className="space-y-2">
        {list.length === 0 && (
          <div className="card text-center opacity-60">暂无提现</div>
        )}
        {list.map((w) => (
          <div key={w.id} className="card flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs opacity-60">{w.user?.username || w.userId}</div>
              <div className="font-bold mt-0.5">{Number(w.amount).toFixed(2)} U</div>
              <div className="text-xs opacity-60 font-mono mt-1 break-all">
                → {w.toAddress}
              </div>
              <div className="text-xs opacity-60 mt-1">
                {new Date(w.createdAt).toLocaleString('zh-CN')}
              </div>
              {w.remark && (
                <div className="text-xs opacity-60 mt-1">备注：{w.remark}</div>
              )}
              {w.txHash && (
                <div className="text-xs opacity-60 mt-1 font-mono break-all">
                  txHash: {w.txHash}
                </div>
              )}
            </div>
            <div className="text-right text-sm space-y-2">
              <StatusTag s={w.status} />
              {w.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    className="btn btn-success text-xs"
                    onClick={() => review(w.id, 'APPROVE')}
                  >
                    已打款并批准
                  </button>
                  <button
                    className="btn btn-danger text-xs"
                    onClick={() => review(w.id, 'REJECT')}
                  >
                    驳回
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusTag({ s }: { s: string }) {
  const map: Record<string, [string, string]> = {
    PENDING: ['tag-yellow', '待审'],
    APPROVED: ['tag', '已批准'],
    SENT: ['tag-green', '已发送'],
    REJECTED: ['tag-red', '已驳回'],
    FAILED: ['tag-red', '失败'],
  };
  const [cls, txt] = map[s] || ['tag-muted', s];
  return <span className={`tag ${cls}`}>{txt}</span>;
}
