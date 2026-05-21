/**
 * 彩池模式（Pari-mutuel）结算逻辑
 *
 * 规则：
 *   - 用户在某个 Outcome 下注，资金进入对应「池子」
 *   - 比赛结束后选定胜出 Outcome
 *   - 平台抽水 = totalStake × rakeBps / 10000
 *   - 剩余资金按用户在胜方池中的占比瓜分（含本金）
 *   - 若胜方无人下注，则全部退款
 *   - 若市场作废（VOIDED），所有用户原路退款
 */
import { prisma } from './db';
import { add, d, mul, sub, toStr } from './money';
import { settleParlayItems } from './parlay';

export type SettleResult = {
  marketId: string;
  status: 'RESOLVED' | 'VOIDED' | 'REFUNDED_NO_WINNER';
  totalStake: string;
  rake: string;
  payoutPool: string;
  winnerOptionKey?: string;
  winnerBetCount: number;
  affectedUsers: number;
};

/**
 * 结算市场
 * @param marketId 市场 ID
 * @param winningKey 胜出 option key（VOIDED 时传 null）
 * @param void 是否作废（true 则全部退款）
 */
export async function settleMarket(
  marketId: string,
  winningKey: string | null,
  voidMarket = false
): Promise<SettleResult> {
  return prisma.$transaction(async (tx) => {
    const market = await tx.market.findUnique({
      where: { id: marketId },
      include: { options: true, bets: { where: { status: 'ACTIVE' } } },
    });
    if (!market) throw new Error('市场不存在');
    if (market.status === 'RESOLVED' || market.status === 'VOIDED') {
      throw new Error(`市场已结算 (${market.status})`);
    }

    // ============= 情况 1: 作废，全员退款 =============
    if (voidMarket || winningKey === null) {
      let affected = 0;
      for (const bet of market.bets) {
        const user = await tx.user.findUnique({ where: { id: bet.userId } });
        if (!user) continue;
        const newBalance = add(user.balanceUsdt, bet.amount);
        await tx.user.update({
          where: { id: user.id },
          data: { balanceUsdt: newBalance },
        });
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: 'VOIDED', payout: bet.amount, settledAt: new Date() },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'BET_REFUND',
            amount: bet.amount,
            balanceAfter: newBalance,
            refType: 'BET',
            refId: bet.id,
            remark: '市场作废全额退款',
          },
        });
        affected++;
      }
      await tx.market.update({
        where: { id: marketId },
        data: { status: 'VOIDED', settledAt: new Date() },
      });
      await settleParlayItems(tx, marketId, null, true);
      return {
        marketId,
        status: 'VOIDED',
        totalStake: market.totalStake,
        rake: '0',
        payoutPool: '0',
        winnerBetCount: 0,
        affectedUsers: affected,
      };
    }

    // ============= 情况 2: 正常结算 =============
    const winningOption = market.options.find((o) => o.key === winningKey);
    if (!winningOption) throw new Error(`胜出选项 ${winningKey} 不存在`);

    const totalStake = market.totalStake;
    const winnerStake = winningOption.totalStake;

    // 子情况 2a: 胜方无人下注 → 全员退款
    if (d(winnerStake).lte(0)) {
      let affected = 0;
      for (const bet of market.bets) {
        const user = await tx.user.findUnique({ where: { id: bet.userId } });
        if (!user) continue;
        const newBalance = add(user.balanceUsdt, bet.amount);
        await tx.user.update({
          where: { id: user.id },
          data: { balanceUsdt: newBalance },
        });
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: 'VOIDED', payout: bet.amount, settledAt: new Date() },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'BET_REFUND',
            amount: bet.amount,
            balanceAfter: newBalance,
            refType: 'BET',
            refId: bet.id,
            remark: '胜方无人下注，全额退款',
          },
        });
        affected++;
      }
      await tx.market.update({
        where: { id: marketId },
        data: {
          status: 'RESOLVED',
          winningKey,
          settledAt: new Date(),
        },
      });
      await settleParlayItems(tx, marketId, winningKey, false);
      return {
        marketId,
        status: 'REFUNDED_NO_WINNER',
        totalStake,
        rake: '0',
        payoutPool: '0',
        winnerOptionKey: winningKey,
        winnerBetCount: 0,
        affectedUsers: affected,
      };
    }

    // 子情况 2b: 正常瓜分
    const rake = mul(totalStake, d(market.rakeBps).div(10000).toString());
    const payoutPool = sub(totalStake, rake);

    let affected = 0;
    let winnerCount = 0;
    for (const bet of market.bets) {
      const user = await tx.user.findUnique({ where: { id: bet.userId } });
      if (!user) continue;

      if (bet.optionId === winningOption.id) {
        // 胜方：按占比分 payoutPool
        const share = d(bet.amount).div(d(winnerStake));
        const payout = toStr(d(payoutPool).times(share));
        const newBalance = add(user.balanceUsdt, payout);
        await tx.user.update({
          where: { id: user.id },
          data: { balanceUsdt: newBalance },
        });
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: 'WON', payout, settledAt: new Date() },
        });
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'BET_PAYOUT',
            amount: payout,
            balanceAfter: newBalance,
            refType: 'BET',
            refId: bet.id,
            remark: `市场结算中奖 (${winningKey})`,
          },
        });
        winnerCount++;
        affected++;
      } else {
        // 败方：标记输
        await tx.bet.update({
          where: { id: bet.id },
          data: { status: 'LOST', payout: '0', settledAt: new Date() },
        });
        affected++;
      }
    }

    await tx.market.update({
      where: { id: marketId },
      data: {
        status: 'RESOLVED',
        winningKey,
        totalRake: rake,
        settledAt: new Date(),
      },
    });
    await settleParlayItems(tx, marketId, winningKey, false);

    return {
      marketId,
      status: 'RESOLVED',
      totalStake,
      rake,
      payoutPool,
      winnerOptionKey: winningKey,
      winnerBetCount: winnerCount,
      affectedUsers: affected,
    };
  }, { timeout: 30000 });
}

// 客户端用的赔率估算见 lib/odds.ts
