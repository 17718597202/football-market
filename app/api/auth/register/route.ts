import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, signSession, setSessionCookie } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';

const schema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母数字下划线'),
  password: z.string().min(6).max(64),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = schema.parse(body);

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return err('用户名已被注册', 409);

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, passwordHash, role: 'USER' },
    });

    const token = await signSession({
      sub: user.id,
      username: user.username,
      role: user.role as any,
    });
    await setSessionCookie(token);

    return ok({ id: user.id, username: user.username, role: user.role });
  } catch (e) {
    return handleError(e);
  }
}
