import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';
import { add, sub } from '@/lib/money';

const schema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  remark: z.string().optional(),
  txHash: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const { action, remark, txHash } = schema.parse(await req.json());

    const wd = await prisma.withdrawal.findUnique({ where: { id: params.id } });
    if (!wd) return err('提现单不存在', 404);
    if (wd.status !== 'PENDING') return err(`当前状态 ${wd.status}，无法审核`);

    if (action === 'REJECT') {
      // 退还冻结金额到余额
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.findUnique({ where: { id: wd.userId } });
        if (!u) throw new Error('用户不存在');
        const newBalance = add(u.balanceUsdt, wd.amount);
        const newFrozen = sub(u.frozenUsdt, wd.amount);
        await tx.user.update({
          where: { id: u.id },
          data: { balanceUsdt: newBalance, frozenUsdt: newFrozen },
        });
        const w = await tx.withdrawal.update({
          where: { id: wd.id },
          data: {
            status: 'REJECTED',
            reviewedBy: admin.id,
            reviewedAt: new Date(),
            remark,
          },
        });
        await tx.transaction.create({
          data: {
            userId: u.id,
            type: 'WITHDRAW_REFUND',
            amount: wd.amount,
            balanceAfter: newBalance,
            refType: 'WITHDRAWAL',
            refId: wd.id,
            remark: '提现被驳回，资金退回',
          },
        });
        return w;
      });
      return ok(updated);
    }

    // APPROVE: 人工已完成打款，系统内直接更新状态并解冻扣除
    const approved = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: wd.userId } });
      if (!u) throw new Error('用户不存在');

      const newFrozen = sub(u.frozenUsdt, wd.amount);
      await tx.user.update({
        where: { id: u.id },
        data: { frozenUsdt: newFrozen },
      });

      const w = await tx.withdrawal.update({
        where: { id: wd.id },
        data: {
          status: 'SENT',
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          remark,
          txHash: txHash || undefined,
        },
      });

      await tx.transaction.create({
        data: {
          userId: u.id,
          type: 'WITHDRAW_RELEASE',
          amount: '0',
          balanceAfter: u.balanceUsdt,
          refType: 'WITHDRAWAL',
          refId: wd.id,
          remark: `提现已人工发送，txHash=${txHash || '未填'}`,
        },
      });

      return w;
    });

    return ok(approved);
  } catch (e) {
    return handleError(e);
  }
}
