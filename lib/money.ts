/**
 * USDT 金额工具：基于 decimal.js 做精度安全计算
 * 数据库中 USDT 一律字符串存储，保留 6 位小数（TRC20 USDT 精度）
 */
import Decimal from 'decimal.js';

Decimal.set({ precision: 30 });

export const USDT_DECIMALS = 6;

export function d(x: string | number | Decimal | bigint): Decimal {
  if (typeof x === 'bigint') return new Decimal(x.toString());
  return new Decimal(x as any);
}

export function toStr(x: Decimal | string | number, decimals = USDT_DECIMALS): string {
  return d(x).toFixed(decimals);
}

export function fmt(x: string | Decimal | number, decimals = 2): string {
  return d(x).toFixed(decimals);
}

export function add(a: string | Decimal, b: string | Decimal): string {
  return d(a).plus(d(b)).toFixed(USDT_DECIMALS);
}

export function sub(a: string | Decimal, b: string | Decimal): string {
  return d(a).minus(d(b)).toFixed(USDT_DECIMALS);
}

export function mul(a: string | Decimal, b: string | Decimal): string {
  return d(a).times(d(b)).toFixed(USDT_DECIMALS);
}

export function div(a: string | Decimal, b: string | Decimal): string {
  return d(a).div(d(b)).toFixed(USDT_DECIMALS);
}

export function gte(a: string | Decimal, b: string | Decimal): boolean {
  return d(a).gte(d(b));
}

export function gt(a: string | Decimal, b: string | Decimal): boolean {
  return d(a).gt(d(b));
}

export function lte(a: string | Decimal, b: string | Decimal): boolean {
  return d(a).lte(d(b));
}

/** sun 转 USDT（TRC20 USDT 6 位精度） */
export function sunToUsdt(sun: string | bigint | number): string {
  return d(sun.toString()).div(10 ** USDT_DECIMALS).toFixed(USDT_DECIMALS);
}

/** USDT 转 sun */
export function usdtToSun(usdt: string | number): bigint {
  const v = d(usdt).times(10 ** USDT_DECIMALS).toFixed(0);
  return BigInt(v);
}
