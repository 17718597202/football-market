import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';
import { add, d, gte, sub, toStr } from '@/lib/money';

const schema = z.object({
  marketId: z.string(),
  optionKey: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { marketId, optionKey, amount } = schema.parse(await req.json());

    const minBet = process.env.MIN_BET_USDT || '1';
    const maxBet = process.env.MAX_BET_USDT || '500';

    if (!gte(amount, minBet)) return err(`单笔最少 ${minBet} USDT`);
    if (!gte(maxBet, amount)) return err(`单笔最多 ${maxBet} USDT`);

    const bet = await prisma.$transaction(async (tx) => {
      const market = await tx.market.findUnique({
        where: { id: marketId },
        include: { options: true },
      });
      if (!market) throw new Error('市场不存在');
      if (market.status !== 'OPEN') throw new Error('市场已锁定，无法下注');
      if (new Date(market.lockAt) <= new Date()) throw new Error('市场已锁定，无法下注');

      const option = market.options.find((o) => o.key === optionKey);
      if (!option) throw new Error('选项不存在');

      const u = await tx.user.findUnique({ where: { id: user.id } });
      if (!u) throw new Error('用户异常');
      if (!gte(u.balanceUsdt, amount)) throw new Error('余额不足');

      const newBalance = sub(u.balanceUsdt, amount);
      await tx.user.update({
        where: { id: u.id },
        data: { balanceUsdt: newBalance },
      });

      const newOptionStake = add(option.totalStake, amount);
      const newMarketStake = add(market.totalStake, amount);

      await tx.marketOption.update({
        where: { id: option.id },
        data: {
          totalStake: newOptionStake,
          betCount: { increment: 1 },
        },
      });
      await tx.market.update({
        where: { id: market.id },
        data: { totalStake: newMarketStake },
      });

      const bet = await tx.bet.create({
        data: {
          userId: u.id,
          marketId: market.id,
          optionId: option.id,
          amount: toStr(amount),
          status: 'ACTIVE',
        },
      });

      await tx.transaction.create({
        data: {
          userId: u.id,
          type: 'BET_PLACE',
          amount: '-' + toStr(amount),
          balanceAfter: newBalance,
          refType: 'BET',
          refId: bet.id,
          remark: `下注 ${market.title} - ${option.label}`,
        },
      });

      return bet;
    });

    return ok(bet);
  } catch (e) {
    return handleError(e);
  }
}

/** 获取当前用户的下注历史 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const where: any = { userId: user.id };
    if (status) where.status = status;

    const bets = await prisma.bet.findMany({
      where,
      include: {
        option: { select: { key: true, label: true } },
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            winningKey: true,
            match: { select: { homeTeam: true, awayTeam: true, kickoffAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return ok(bets);
  } catch (e) {
    return handleError(e);
  }
}
