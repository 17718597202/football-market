import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api';

/** 手动锁定市场（停止下注） */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const m = await prisma.market.update({
      where: { id: params.id },
      data: { status: 'LOCKED' },
    });
    return ok(m);
  } catch (e) {
    return handleError(e);
  }
}
