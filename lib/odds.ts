/**
 * 纯客户端可用的赔率估算工具
 * （不能在 lib/pari-mutuel.ts 里因为那里 import 了 prisma，会把 server 代码打进客户端 bundle）
 */
import Decimal from 'decimal.js';

const d = (x: string | number) => new Decimal(x as any);

/**
 * 估算「我刚刚下注后，假设该选项胜出」的赔率与预计返还
 */
export function estimateOdds(
  totalStake: string,
  optionStakes: { key: string; stake: string }[],
  targetKey: string,
  betAmount: string,
  rakeBps: number
): { impliedOdds: string; estimatedPayout: string } {
  if (!betAmount || Number(betAmount) <= 0) {
    return { impliedOdds: '—', estimatedPayout: '—' };
  }
  const newTotal = d(totalStake).plus(d(betAmount));
  const targetStake = d(
    optionStakes.find((o) => o.key === targetKey)?.stake || 0
  ).plus(d(betAmount));
  if (targetStake.lte(0)) {
    return { impliedOdds: '—', estimatedPayout: '—' };
  }
  const payoutPool = newTotal.times(1 - rakeBps / 10000);
  const myShare = d(betAmount).div(targetStake);
  const myPayout = payoutPool.times(myShare);
  const odds = myPayout.div(d(betAmount));
  return {
    impliedOdds: odds.toFixed(2),
    estimatedPayout: myPayout.toFixed(2),
  };
}
