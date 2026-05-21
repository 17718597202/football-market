import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ok, handleError } from '@/lib/api';

/**
 * 获取市场列表
 * query: status=OPEN|LOCKED|RESOLVED, limit=20, offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);
    const offset = Number(url.searchParams.get('offset') || 0);

    const where: any = {};
    if (status) where.status = status;

    const markets = await prisma.market.findMany({
      where,
      include: {
        match: true,
        options: { orderBy: { id: 'asc' } },
        _count: { select: { bets: true } },
      },
      orderBy: [{ status: 'asc' }, { lockAt: 'asc' }],
      take: limit,
      skip: offset,
    });

    return ok(markets);
  } catch (e) {
    return handleError(e);
  }
}
