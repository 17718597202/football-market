/**
 * 串关 (Parlay) 核心计算与结算库
 */
import { prisma } from './db';
import { add, sub, mul, d, toStr } from './money';
import Decimal from 'decimal.js';

// =========================================================
// 串关全局风控阈值配置
// =========================================================
export const MIN_PARLAY_LIQUIDITY = Number(process.env.MIN_PARLAY_LIQUIDITY || '500'); // 最低准入单场池额 (500 USDT)
export const MAX_LEG_ODDS = Number(process.env.MAX_LEG_ODDS || '10.00'); // 单场赔率上限 (10.00x)
export const MAX_PARLAY_ODDS = Number(process.env.MAX_PARLAY_ODDS || '500.00'); // 串单总赔率上限 (500.00x)
export const MAX_PARLAY_PAYOUT = Number(process.env.MAX_PARLAY_PAYOUT || '5000.00'); // 单单最高派彩封顶 (5,000 USDT)

/**
 * 实时计算某单场选项在当前彩池中的估算固定赔率
 * 规则：Odds = (totalStake * (1 - rakeBps/10000)) / optionStake
 */
export async function calculateOptionOdds(optionId: string): Promise<string> {
  const option = await prisma.marketOption.findUnique({
    where: { id: optionId },
    include: { market: true },
  });

  if (!option) {
    throw new Error('选项不存在');
  }

  const market = option.market;
  const rakeFactor = 1 - market.rakeBps / 10000;
  
  const mTotal = d(market.totalStake);
  const oStake = d(option.totalStake);

  if (mTotal.lte(0) || oStake.lte(0)) {
    // 冷启动兜底：如果完全没有资金，默认生成一个 1.85 倍的常规赔率
    return '1.85';
  }

  const payoutPool = mTotal.times(rakeFactor);
  const rawOdds = payoutPool.div(oStake);

  // 限制最低赔率不低于 1.01，且最高赔率不超过 MAX_LEG_ODDS 限制
  if (rawOdds.lt(1.01)) return '1.01';
  if (rawOdds.gt(MAX_LEG_ODDS)) return MAX_LEG_ODDS.toFixed(2);
  
  return rawOdds.toFixed(2);
}

/**
 * 提交并生成固定赔率串关订单 (Parlay Bet)
 * @param userId 用户 ID
 * @param amount 投注总本金
 * @param selections 串关选取的 Leg 数组
 */
export async function placeParlayBet(
  userId: string,
  amount: string,
  selections: { marketId: string; optionId: string }[]
) {
  if (selections.length < 2) {
    throw new Error('串关投注必须包含至少 2 个单场选项');
  }

  const amtNum = Number(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    throw new Error('投注金额不合法');
  }

  return prisma.$transaction(async (tx) => {
    // 1. 验证用户余额
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('用户不存在');
    if (d(user.balanceUsdt).lt(amount)) {
      throw new Error('USDT 余额不足，请先充值');
    }

    // 2. 验证串关的每场比赛是否唯一，不能选择同一场比赛的多个不同玩法 (防止套利 / Correlated Parlays)
    const marketIds = selections.map((s) => s.marketId);
    const markets = await tx.market.findMany({
      where: { id: { in: marketIds } },
      include: { match: true },
    });

    if (markets.length !== selections.length) {
      throw new Error('部分选择的市场选项无效');
    }

    const matchIds = new Set(markets.map((m) => m.matchId));
    if (matchIds.size !== selections.length) {
      throw new Error('串关投注仅允许跨不同比赛的选项，禁止对同一场比赛的多个不同玩法进行串关');
    }

    // 3. 验证是否有已经开赛的赛程，且验证最低资金池要求
    const now = new Date();
    for (const m of markets) {
      if (m.status !== 'OPEN' || m.lockAt <= now) {
        throw new Error(`比赛已开赛锁定，无法进行投注: ${m.title}`);
      }
      
      // 准入门槛风控：校验池子总流动性是否满足最低串关条件
      if (d(m.totalStake).lt(MIN_PARLAY_LIQUIDITY)) {
        throw new Error(`比赛 [${m.title}] 玩法资金池 (${m.totalStake} USDT) 低于最低串关门槛 (${MIN_PARLAY_LIQUIDITY} USDT)`);
      }
    }

    // 4. 计算每个选项锁死的赔率及乘积总赔率
    const itemSelections: { marketId: string; optionId: string; odds: string }[] = [];
    let totalOdds = d(1);

    for (const s of selections) {
      const opt = await tx.marketOption.findUnique({
        where: { id: s.optionId },
        include: { market: true },
      });
      if (!opt) throw new Error('选项不存在');

      // 计算当前彩池预估固定赔率
      const rakeFactor = 1 - opt.market.rakeBps / 10000;
      const mTotal = d(opt.market.totalStake);
      const oStake = d(opt.totalStake);
      
      let optionOdds = d(1.85); // 默认兜底
      if (mTotal.gt(0) && oStake.gt(0)) {
        const payout = mTotal.times(rakeFactor);
        const calc = payout.div(oStake);
        const cappedOdds = calc.gt(MAX_LEG_ODDS) ? d(MAX_LEG_ODDS) : calc;
        optionOdds = cappedOdds.lt(1.01) ? d(1.01) : cappedOdds;
      }

      totalOdds = totalOdds.times(optionOdds);
      itemSelections.push({
        marketId: s.marketId,
        optionId: s.optionId,
        odds: optionOdds.toFixed(2),
      });
    }

    // 整单总赔率封顶限制
    if (totalOdds.gt(MAX_PARLAY_ODDS)) {
      totalOdds = d(MAX_PARLAY_ODDS);
    }
    const finalTotalOdds = totalOdds.toFixed(2);

    // 5. 扣减用户可用余额
    const newBalance = sub(user.balanceUsdt, amount);
    await tx.user.update({
      where: { id: user.id },
      data: { balanceUsdt: newBalance },
    });

    // 6. 创建串关主订单
    const parlayBet = await tx.parlayBet.create({
      data: {
        userId: user.id,
        amount,
        odds: finalTotalOdds,
        status: 'ACTIVE',
        items: {
          create: itemSelections.map((item) => ({
            marketId: item.marketId,
            optionId: item.optionId,
            odds: item.odds,
            status: 'ACTIVE',
          })),
        },
      },
    });

    // 7. 写入资金变动流水
    await tx.transaction.create({
      data: {
        userId: user.id,
        type: 'BET_PLACE',
        amount: `-${amount}`,
        balanceAfter: newBalance,
        refType: 'BET',
        refId: parlayBet.id,
        remark: `购买固定赔率串关 (${selections.length}串1), 锁死赔率 ${finalTotalOdds}`,
      },
    });

    return parlayBet;
  });
}

/**
 * 级联结算串关 Legs。此函数需被嵌入在单个单场 settleMarket() 的底层 Prisma 数据库事务中
 */
export async function settleParlayItems(
  tx: any,
  marketId: string,
  winningKey: string | null,
  voidMarket = false
) {
  // 1. 获取所有跟该场比赛关联的 ACTIVE 状态的串关单子 Leg
  const activeLegs = await tx.parlayItem.findMany({
    where: { marketId, status: 'ACTIVE' },
    include: { option: true },
  });

  if (activeLegs.length === 0) return;

  console.log(`[parlay-settle] 正在级联更新 ${activeLegs.length} 个串关投注 Leg (市场: ${marketId})...`);

  for (const leg of activeLegs) {
    let legStatus: 'WON' | 'LOST' | 'VOIDED' = 'LOST';

    if (voidMarket || winningKey === null) {
      // 单场比赛作废，此 Leg 判定为 VOIDED (赔率修正为 1.0)
      legStatus = 'VOIDED';
    } else {
      if (leg.option.key === winningKey) {
        legStatus = 'WON';
      } else {
        legStatus = 'LOST';
      }
    }

    // 更新当前 Leg 状态
    await tx.parlayItem.update({
      where: { id: leg.id },
      data: { status: legStatus },
    });

    // 2. 检查父串关单 (ParlayBet) 状态
    const parentId = leg.parlayBetId;
    const parentBet = await tx.parlayBet.findUnique({
      where: { id: parentId },
      include: { items: true },
    });

    if (!parentBet || parentBet.status !== 'ACTIVE') continue;

    // 检查是否有任一单场输掉
    const hasLost = parentBet.items.some((item: any) => item.status === 'LOST');
    if (hasLost) {
      // 只要有一场输，整个串单即死，标记为输，无派彩
      await tx.parlayBet.update({
        where: { id: parentId },
        data: { status: 'LOST', payout: '0', settledAt: new Date() },
      });
      console.log(`[parlay-settle] 串关单 ${parentId} 预测失败 (LOST)`);
      continue;
    }

    // 检查是否所有单场已全部完成（即不存在 ACTIVE）
    const allFinished = parentBet.items.every((item: any) => item.status !== 'ACTIVE');
    if (allFinished) {
      // 所有比赛全部结束且全是 WON 或 VOIDED → 整个串关获胜 (WON)
      // 计算最终的修正串关总赔率
      let finalMultiplier = new Decimal(1);
      for (const item of parentBet.items) {
        if (item.status === 'WON') {
          finalMultiplier = finalMultiplier.times(new Decimal(item.odds));
        } else if (item.status === 'VOIDED') {
          // 作废场次赔率按 1.0 计算
          finalMultiplier = finalMultiplier.times(new Decimal(1));
        }
      }

      // 将最终的总赔率取 2 位小数四舍五入，确保派彩本金计算与页面显示的赔率绝对一致
      const roundedMultiplier = finalMultiplier.toDP(2, Decimal.ROUND_HALF_UP);
      
      let rawPayout = roundedMultiplier.times(new Decimal(parentBet.amount));
      let isCapped = false;
      
      // 单笔最高派彩风控限额
      const limitPayout = new Decimal(MAX_PARLAY_PAYOUT);
      if (rawPayout.gt(limitPayout)) {
        rawPayout = limitPayout;
        isCapped = true;
      }
      
      const finalPayout = rawPayout.toFixed(2);

      // 为中奖用户分发余额并修改订单状态
      const user = await tx.user.findUnique({ where: { id: parentBet.userId } });
      if (user) {
        const newBalance = add(user.balanceUsdt, finalPayout);
        await tx.user.update({
          where: { id: user.id },
          data: { balanceUsdt: newBalance },
        });

        await tx.parlayBet.update({
          where: { id: parentId },
          data: {
            status: 'WON',
            payout: finalPayout,
            settledAt: new Date(),
          },
        });

        const remarkNote = isCapped
          ? `串关投注获胜派彩 (${parentBet.items.length}串1), 最终赔率 ${finalMultiplier.toFixed(2)} (触发单单最高派彩上限封顶，原应收 ${roundedMultiplier.times(new Decimal(parentBet.amount)).toFixed(2)} U)`
          : `串关投注获胜派彩 (${parentBet.items.length}串1), 最终赔率 ${finalMultiplier.toFixed(2)}`;

        // 生成派彩流水记录
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'BET_PAYOUT',
            amount: finalPayout,
            balanceAfter: newBalance,
            refType: 'BET',
            refId: parentId,
            remark: remarkNote,
          },
        });

        console.log(`[parlay-settle] 🎉 串关单 ${parentId} 预测成功！派彩 ${finalPayout} U`);
      }
    }
  }
}
