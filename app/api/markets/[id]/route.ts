import { prisma } from '@/lib/db';
import { ok, err, handleError } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const market = await prisma.market.findUnique({
      where: { id: params.id },
      include: {
        match: true,
        options: { orderBy: { id: 'asc' } },
      },
    });
    if (!market) return err('市场不存在', 404);

    const user = await getCurrentUser();
    const myBets = user
      ? await prisma.bet.findMany({
          where: { marketId: market.id, userId: user.id },
          orderBy: { createdAt: 'desc' },
          include: { option: { select: { key: true, label: true } } },
        })
      : [];

    return ok({ market, myBets });
  } catch (e) {
    return handleError(e);
  }
}
