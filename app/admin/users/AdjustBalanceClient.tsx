'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdjustBalanceClient({ userId, currentBalance }: { userId: string, currentBalance: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAdjust() {
    const amountStr = prompt(`当前余额: ${currentBalance} U\n请输入调整金额（正数增加，负数扣除）：`);
    if (!amountStr) return;
    
    const amount = Number(amountStr);
    if (isNaN(amount) || amount === 0) {
      alert('请输入有效的数字');
      return;
    }

    const remark = prompt('请输入调整原因/备注：') || '人工调整余额';

    if (!confirm(`确认要给用户 ${amount > 0 ? '增加' : '扣除'} ${Math.abs(amount)} U 吗？`)) return;

    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: String(amount), remark }),
      });
      const j = await r.json();
      if (!j.ok) {
        alert('失败: ' + j.error);
      } else {
        router.refresh();
      }
    } catch (e: any) {
      alert('出错: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button 
      onClick={handleAdjust} 
      disabled={loading}
      className="btn btn-sm btn-outline text-xs mt-2"
    >
      {loading ? '处理中...' : '调整资金'}
    </button>
  );
}
