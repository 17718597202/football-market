import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';
import { add, sub } from '@/lib/money';

const schema = z.object({
  amount: z.string(),
  remark: z.string(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const { amount, remark } = schema.parse(await req.json());
    
    if (isNaN(Number(amount)) || Number(amount) === 0) {
      return err('无效的金额');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: params.id } });
      if (!u) throw new Error('用户不存在');

      const newBalance = add(u.balanceUsdt, amount);
      if (Number(newBalance) < 0) {
        throw new Error('扣款后余额不能小于 0');
      }

      await tx.user.update({
        where: { id: u.id },
        data: { balanceUsdt: newBalance },
      });

      await tx.transaction.create({
        data: {
          userId: u.id,
          type: 'ADJUSTMENT',
          amount: amount,
          balanceAfter: newBalance,
          remark: remark || '人工调整余额',
        },
      });

      return { balanceUsdt: newBalance };
    });

    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
