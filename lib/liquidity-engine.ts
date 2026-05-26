import { prisma } from './db';
import { add, sub, toStr } from './money';

const SYSTEM_BOT_USERNAME = 'system_liquidity_bot';

// 俱乐部实力评分字典 (用于模拟生成极度真实的足球赔率和流动性)
const TEAM_STRENGTHS: Record<string, number> = {
  // 英超
  '曼城': 96, '阿森纳': 94, '利物浦': 93, '切尔西': 87, '热刺': 86, '曼联': 85,
  '纽卡斯尔联': 84, '阿斯顿维拉': 84, '布莱顿': 82, '西汉姆联': 80,
  'Manchester City': 96, 'Arsenal': 94, 'Liverpool': 93, 'Chelsea': 87,
  'Tottenham Hotspur': 86, 'Manchester United': 85, 'Newcastle United': 84,
  'Aston Villa': 84, 'Brighton & Hove Albion': 82, 'West Ham United': 80,

  // 西甲
  '皇家马德里': 96, '巴塞罗那': 91, '马德里竞技': 89, '皇家社会': 84,
  '比利亚雷亚尔': 82, '赫罗纳': 83, '瓦伦西亚': 80, '塞维利亚': 81,
  'Real Madrid': 96, 'Barcelona': 91, 'Atlético Madrid': 89, 'Real Sociedad': 84,
  'Villarreal': 82, 'Girona': 83, 'Valencia': 80, 'Sevilla': 81,

  // 意甲/德甲/法甲/欧联
  '拜仁慕尼黑': 94, '巴黎圣日耳曼': 93, '国际米兰': 92, 'AC米兰': 87, '尤文图斯': 86,
  'Bayern Munich': 94, 'Paris Saint-Germain': 93, 'Inter Milan': 92,
};

function getStrength(teamName: string): number {
  for (const [key, val] of Object.entries(TEAM_STRENGTHS)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(teamName.toLowerCase())) {
      return val;
    }
  }
  return 75; // 默认的中游球队实力基准
}

/**
 * 为特定的预测玩法市场注入仿真水子（使用系统机器人账号进行对账一致性下注）
 * @param marketId 预测玩法市场 ID
 */
export async function injectMarketLiquidity(marketId: string) {
  // 1. 确保特权注水机器人账户存在
  let bot = await prisma.user.findUnique({
    where: { username: SYSTEM_BOT_USERNAME }
  });

  if (!bot) {
    bot = await prisma.user.create({
      data: {
        username: SYSTEM_BOT_USERNAME,
        passwordHash: 'SYSTEM_BOT_NO_PASSWORD',
        role: 'USER',
        balanceUsdt: '10000000.00', // 给予充足的注水额度
        frozenUsdt: '0',
      }
    });
  }

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { match: true, options: true },
  });
  if (!market) return;

  const homeStr = getStrength(market.match.homeTeam);
  const awayStr = getStrength(market.match.awayTeam);

  // 1. 计算双方胜平负的概率基准（包含 5% 的主场优势因子）
  const homeAdvantage = 1.05;
  const rawHome = homeStr * homeAdvantage;
  const rawAway = awayStr;

  const totalRaw = rawHome + rawAway;
  const homeProb = rawHome / totalRaw;
  const awayProb = rawAway / totalRaw;

  // 足球平局期望（标准假定在 24% - 27% 之间）
  const baseDraw = 0.25;
  const finalHomeProb = homeProb * (1 - baseDraw);
  const finalAwayProb = awayProb * (1 - baseDraw);
  const finalDrawProb = baseDraw;

  // 设定该彩池随机的流动性底盘资金（2500 U 到 7500 U 之间）
  const targetTotal = Math.floor(Math.random() * 5000) + 2500;
  const optionsBets: { optionId: string; amount: string; label: string }[] = [];

  if (market.type === 'RESULT_1X2') {
    const ratios: Record<string, number> = {
      HOME: finalHomeProb,
      DRAW: finalDrawProb,
      AWAY: finalAwayProb,
    };

    // 加入 5% 左右的随机买盘噪点微调，防止过于刻板
    const randNoise = 0.95 + Math.random() * 0.1;
    ratios.HOME *= randNoise;

    const sum = ratios.HOME + ratios.DRAW + ratios.AWAY;
    ratios.HOME /= sum;
    ratios.DRAW /= sum;
    ratios.AWAY /= sum;

    for (const opt of market.options) {
      const share = ratios[opt.key] || 0.33;
      const stake = Math.floor(targetTotal * share);
      optionsBets.push({
        optionId: opt.id,
        amount: String(stake),
        label: opt.label,
      });
    }
  } else if (market.type === 'CORRECT_SCORE') {
    // 依交战实力差调整波胆分布
    const strengthDiff = homeStr - awayStr;

    const csBaseRatios: Record<string, number> = {
      // 主胜
      '1:0': 0.12, '2:0': 0.09, '2:1': 0.13, '3:0': 0.04, '3:1': 0.05, '3:2': 0.02,
      // 平局
      '0:0': 0.08, '1:1': 0.14, '2:2': 0.05, '3:3': 0.01,
      // 客胜
      '0:1': 0.09, '0:2': 0.04, '1:2': 0.06, '0:3': 0.01, '1:3': 0.01, '2:3': 0.01,
      // 其他
      'OTHER': 0.01,
    };

    const adjustedRatios: Record<string, number> = {};
    let sum = 0;

    for (const [scoreKey, baseVal] of Object.entries(csBaseRatios)) {
      let factor = 1.0;
      if (scoreKey !== 'OTHER') {
        const [h, a] = scoreKey.split(':').map(Number);
        if (h > a) {
          factor = strengthDiff > 0 ? (1 + strengthDiff / 25) : (1 + strengthDiff / 50);
        } else if (h < a) {
          factor = strengthDiff < 0 ? (1 - strengthDiff / 25) : (1 - strengthDiff / 50);
        } else {
          factor = Math.max(1 - Math.abs(strengthDiff) / 80, 0.2);
        }
      }

      // 添加局部的扰动噪声
      const noise = 0.85 + Math.random() * 0.3;
      adjustedRatios[scoreKey] = baseVal * Math.max(factor, 0.1) * noise;
      sum += adjustedRatios[scoreKey];
    }

    for (const opt of market.options) {
      const share = (adjustedRatios[opt.key] || 0.01) / sum;
      const stake = Math.max(Math.floor(targetTotal * share), 10); // 兜底每个选项 10 U 流动性
      optionsBets.push({
        optionId: opt.id,
        amount: String(stake),
        label: opt.label,
      });
    }
  }

  // 2. 在一个标准的 Prisma 事务里执行机器人下注，确保资金明细 100% 对账一致
  await prisma.$transaction(async (tx) => {
    // 重新获取机器人，确保最新的 balance
    const u = await tx.user.findUnique({ where: { id: bot.id } });
    if (!u) throw new Error('System bot account missing in transaction');

    let currentBotBalance = u.balanceUsdt;
    let distributedStake = 0;

    for (const b of optionsBets) {
      const stakeAmount = b.amount;
      distributedStake += Number(stakeAmount);

      // 扣除机器人虚拟账户余额
      currentBotBalance = sub(currentBotBalance, stakeAmount);

      // 创建 Bet 记录
      const bet = await tx.bet.create({
        data: {
          userId: u.id,
          marketId: market.id,
          optionId: b.optionId,
          amount: toStr(stakeAmount),
          status: 'ACTIVE',
        },
      });

      // 创建账户流水记录
      await tx.transaction.create({
        data: {
          userId: u.id,
          type: 'BET_PLACE',
          amount: '-' + toStr(stakeAmount),
          balanceAfter: currentBotBalance,
          refType: 'BET',
          refId: bet.id,
          remark: `系统注水机器人模拟下注 - ${b.label}`,
        },
      });

      // 更新 Option 的 Stake 和 Count
      const option = await tx.marketOption.findUnique({ where: { id: b.optionId } });
      if (option) {
        await tx.marketOption.update({
          where: { id: b.optionId },
          data: {
            totalStake: toStr(add(option.totalStake, stakeAmount)),
            betCount: { increment: 1 },
          },
        });
      }
    }

    // 更新机器人的最终余额
    await tx.user.update({
      where: { id: u.id },
      data: { balanceUsdt: currentBotBalance },
    });

    // 更新 Market 的总 Stake
    const m = await tx.market.findUnique({ where: { id: marketId } });
    if (m) {
      await tx.market.update({
        where: { id: marketId },
        data: {
          totalStake: toStr(add(m.totalStake, String(distributedStake))),
        },
      });
    }

    console.log(`[liquidity] 机器人对账注入成功！彩池 ${market.title} 注入订单总量=${optionsBets.length} 总金额=${distributedStake} U`);
  }, { timeout: 30000 });
}
