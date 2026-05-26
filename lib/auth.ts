/**
 * 鉴权工具
 * - JWT 用 jose（Edge Runtime 友好）
 * - 密码哈希用 bcryptjs
 */
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev_secret_change_me_in_production'
);
const ALG = 'HS256';
const COOKIE_NAME = 'yuce_session';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 天

export type JWTPayload = {
  sub: string; // userId
  username: string;
  role: 'USER' | 'ADMIN';
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALG] });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: false, // 允许在非 HTTPS (HTTP) 的服务器上正常测试登录
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  });
}

export async function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getCurrentUserPayload(): Promise<JWTPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentUser() {
  const payload = await getCurrentUserPayload();
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.sub } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return user;
}
