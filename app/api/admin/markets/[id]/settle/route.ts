import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, handleError } from '@/lib/api';
import { settleMarket } from '@/lib/pari-mutuel';

const schema = z.object({
  winningKey: z.string().nullable(),
  voidMarket: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const { winningKey, voidMarket } = schema.parse(await req.json());
    const result = await settleMarket(params.id, winningKey, voidMarket);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
