import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';

const createSchema = z.object({
  // 可以从已有 match 复用，也可以同时创建新 match
  matchId: z.string().optional(),
  newMatch: z
    .object({
      competition: z.string(),
      homeTeam: z.string(),
      awayTeam: z.string(),
      kickoffAt: z.string(), // ISO date
    })
    .optional(),
  type: z.string().default('RESULT_1X2'),
  title: z.string(),
  description: z.string().optional(),
  lockAt: z.string(), // ISO date
  rakeBps: z.number().int().min(0).max(2000).optional(),
  options: z
    .array(z.object({ key: z.string(), label: z.string() }))
    .min(2),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const data = createSchema.parse(await req.json());

    let matchId = data.matchId;
    if (!matchId) {
      if (!data.newMatch) return err('必须提供 matchId 或 newMatch');
      const m = await prisma.match.create({
        data: {
          competition: data.newMatch.competition,
          homeTeam: data.newMatch.homeTeam,
          awayTeam: data.newMatch.awayTeam,
          kickoffAt: new Date(data.newMatch.kickoffAt),
          status: 'SCHEDULED',
        },
      });
      matchId = m.id;
    }

    const market = await prisma.market.create({
      data: {
        matchId,
        type: data.type,
        title: data.title,
        description: data.description,
        lockAt: new Date(data.lockAt),
        rakeBps: data.rakeBps ?? Number(process.env.PLATFORM_RAKE_BPS || 300),
        options: { create: data.options },
      },
      include: { options: true, match: true },
    });

    return ok(market);
  } catch (e) {
    return handleError(e);
  }
}

/** 管理后台市场列表 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const where: any = {};
    if (status) where.status = status;
    const list = await prisma.market.findMany({
      where,
      include: {
        match: true,
        options: true,
        _count: { select: { bets: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return ok(list);
  } catch (e) {
    return handleError(e);
  }
}
