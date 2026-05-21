import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';
import { isValidTronAddress } from '@/lib/tron';

const schema = z.object({ tronAddress: z.string() });

/**
 * 绑定 TRC20 充值来源地址（充值必须从该地址转入才会被自动入账）
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { tronAddress } = schema.parse(await req.json());
    if (!(await isValidTronAddress(tronAddress))) {
      return err('Tron 地址格式不合法');
    }
    const dup = await prisma.user.findUnique({ where: { tronAddress } });
    if (dup && dup.id !== user.id) return err('该地址已被其他用户绑定', 409);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { tronAddress },
    });
    return ok({ tronAddress: updated.tronAddress });
  } catch (e) {
    return handleError(e);
  }
}
