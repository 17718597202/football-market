/**
 * API 路由通用工具
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data });
}

export function err(message: string, code = 400, extra?: any) {
  return NextResponse.json(
    { ok: false, error: message, ...(extra || {}) },
    { status: code }
  );
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return err('参数错误: ' + e.issues.map((i) => i.message).join('; '), 400);
  }
  if (e instanceof Error) {
    if (e.message === 'UNAUTHORIZED') return err('未登录', 401);
    if (e.message === 'FORBIDDEN') return err('无权限', 403);
    return err(e.message, 400);
  }
  return err('内部错误', 500);
}
