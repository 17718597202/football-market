import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, signSession, setSessionCookie } from '@/lib/auth';
import { ok, err, handleError } from '@/lib/api';

const schema = z.object({
  username: z.string(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const { username, password } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return err('用户名或密码错误', 401);
    const okPwd = await verifyPassword(password, user.passwordHash);
    if (!okPwd) return err('用户名或密码错误', 401);

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
