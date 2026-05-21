import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const where: any = {};
    if (status) where.status = status;
    const list = await prisma.withdrawal.findMany({
      where,
      include: { user: { select: { username: true, id: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok(list);
  } catch (e) {
    return handleError(e);
  }
}
