import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';
import { add, gte, sub, toStr } from '@/lib/money';
import { isValidBscAddress } from '@/lib/bsc';

const schema = z.object({
  toAddress: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
});

/**
 * 用户发起提现：余额扣除并冻结，等待管理员审核
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { toAddress, amount } = schema.parse(await req.json());

    if (!(await isValidBscAddress(toAddress))) return err('BSC 提现地址不合法');

    const minWd = process.env.MIN_WITHDRAW_USDT || '10';
    if (!gte(amount, minWd)) return err(`最低提现 ${minWd} USDT`);

    const w = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: user.id } });
      if (!u) throw new Error('用户异常');
      if (!gte(u.balanceUsdt, amount)) throw new Error('余额不足');

      const newBalance = sub(u.balanceUsdt, amount);
      const newFrozen = add(u.frozenUsdt, amount);

      await tx.user.update({
        where: { id: u.id },
        data: { balanceUsdt: newBalance, frozenUsdt: newFrozen },
      });

      const wd = await tx.withdrawal.create({
        data: {
          userId: u.id,
          toAddress,
          amount: toStr(amount),
          fee: '0',
          netAmount: toStr(amount),
          status: 'PENDING',
        },
      });

      await tx.transaction.create({
        data: {
          userId: u.id,
          type: 'WITHDRAW_LOCK',
          amount: '-' + toStr(amount),
          balanceAfter: newBalance,
          refType: 'WITHDRAWAL',
          refId: wd.id,
          remark: `提现申请到 ${toAddress}`,
        },
      });

      return wd;
    });

    return ok(w);
  } catch (e) {
    return handleError(e);
  }
}
