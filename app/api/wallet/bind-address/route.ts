import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';
import { isValidBscAddress } from '@/lib/bsc';

const schema = z.object({ bscAddress: z.string() });

/**
 * 绑定 BSC BEP20 充值来源地址（充值必须从该地址转入才会被自动入账）
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { bscAddress } = schema.parse(await req.json());
    if (!(await isValidBscAddress(bscAddress))) {
      return err('BSC 钱包地址格式不合法');
    }
    const dup = await prisma.user.findUnique({ where: { bscAddress } });
    if (dup && dup.id !== user.id) return err('该地址已被其他用户绑定', 409);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { bscAddress },
    });
    return ok({ bscAddress: updated.bscAddress });
  } catch (e) {
    return handleError(e);
  }
}
