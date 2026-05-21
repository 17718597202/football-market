import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api';
import { listMatches, mapStatus, type CompetitionCode, winnerToKey } from '@/lib/football-data';

const schema = z.object({
  competition: z.string(), // PL/PD/BL1/SA/FL1/CL/EL/EC/WC
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  autoCreate1x2: z.boolean().optional(), // 是否自动创建胜平负市场
});

/**
 * 从 football-data.org 同步赛程，可选自动创建胜平负市场
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());

    const matches = await listMatches(body.competition as CompetitionCode, {
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    });

    let created = 0,
      updated = 0,
      marketsCreated = 0;
    for (const m of matches) {
      const status = mapStatus(m.status);
      const finalResult =
        status === 'FINISHED' ? winnerToKey(m.score?.winner ?? null) : null;
      const existing = await prisma.match.findUnique({
        where: { externalId: String(m.id) },
      });
      const data = {
        externalId: String(m.id),
        competition: m.competition.name,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeLogo: m.homeTeam.crest,
        awayLogo: m.awayTeam.crest,
        kickoffAt: new Date(m.utcDate),
        status,
        homeScore: m.score?.fullTime?.home ?? null,
        awayScore: m.score?.fullTime?.away ?? null,
        finalResult,
      };
      let match;
      if (existing) {
        match = await prisma.match.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        match = await prisma.match.create({ data });
        created++;
      }

      // 自动建胜平负市场（仅未开赛 & 该 match 还没建过该类型市场）
      if (body.autoCreate1x2 && status === 'SCHEDULED') {
        const existingMarket = await prisma.market.findFirst({
          where: { matchId: match.id, type: 'RESULT_1X2' },
        });
        if (!existingMarket) {
          await prisma.market.create({
            data: {
              matchId: match.id,
              type: 'RESULT_1X2',
              title: `${match.homeTeam} vs ${match.awayTeam} - 全场胜平负`,
              description: '90 分钟内结果，不含加时与点球',
              lockAt: match.kickoffAt,
              rakeBps: Number(process.env.PLATFORM_RAKE_BPS || 300),
              options: {
                create: [
                  { key: 'HOME', label: `${match.homeTeam} 胜` },
                  { key: 'DRAW', label: '平局' },
                  { key: 'AWAY', label: `${match.awayTeam} 胜` },
                ],
              },
            },
          });
          marketsCreated++;
        }
      }
    }

    return ok({ total: matches.length, created, updated, marketsCreated });
  } catch (e) {
    return handleError(e);
  }
}
