import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';
import { placeParlayBet } from '@/lib/parlay';
import { gte } from '@/lib/money';

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  selections: z.array(
    z.object({
      marketId: z.string(),
      optionId: z.string(),
    })
  ),
});

/**
 * 购买固定赔率串关
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.parse(body);

    const minBet = process.env.MIN_BET_USDT || '1';
    const maxBet = process.env.MAX_BET_USDT || '500';

    if (!gte(parsed.amount, minBet)) return err(`单笔最少 ${minBet} USDT`);
    if (!gte(maxBet, parsed.amount)) return err(`单笔最多 ${maxBet} USDT`);

    const bet = await placeParlayBet(user.id, parsed.amount, parsed.selections);
    return ok(bet);
  } catch (e) {
    return handleError(e);
  }
}

/**
 * 获取当前用户的串关历史记录
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    
    const where: any = { userId: user.id };
    if (status) where.status = status;

    const parlayBets = await prisma.parlayBet.findMany({
      where,
      include: {
        items: {
          include: {
            market: {
              select: {
                id: true,
                title: true,
                type: true,
                status: true,
                winningKey: true,
                match: {
                  select: {
                    homeTeam: true,
                    awayTeam: true,
                    status: true,
                    homeScore: true,
                    awayScore: true,
                  },
                },
              },
            },
            option: {
              select: {
                key: true,
                label: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return ok(parlayBets);
  } catch (e) {
    return handleError(e);
  }
}
