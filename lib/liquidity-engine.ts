/**
 * 智能彩池流动性自动注水引擎
 * (Automated Pari-mutuel Liquidity & Odds Generator)
 */
import { prisma } from './db';

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
 * 为特定的预测玩法市场注入仿真水子（流动性种子资金）
 * @param marketId 预测玩法市场 ID
 */
export async function injectMarketLiquidity(marketId: string) {
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
  let distributedStake = 0;

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

    const updatePromises = [];
    for (const opt of market.options) {
      const share = ratios[opt.key] || 0.33;
      const stake = Math.floor(targetTotal * share);
      distributedStake += stake;

      updatePromises.push(
        prisma.marketOption.update({
          where: { id: opt.id },
          data: {
            totalStake: String(stake),
            betCount: Math.floor(stake / (15 + Math.random() * 30)) + 3,
          },
        })
      );
    }
    await Promise.all(updatePromises);
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
          // 主胜比分：如果主队更强，放大该比分投注占比
          factor = strengthDiff > 0 ? (1 + strengthDiff / 25) : (1 + strengthDiff / 50);
        } else if (h < a) {
          // 客胜比分：如果客队更强，放大该比分投注占比
          factor = strengthDiff < 0 ? (1 - strengthDiff / 25) : (1 - strengthDiff / 50);
        } else {
          // 平局比分：两队实力越接近，平局越易发生；实力差越悬殊，平局概率越小
          factor = Math.max(1 - Math.abs(strengthDiff) / 80, 0.2);
        }
      }

      // 添加局部的扰动噪声
      const noise = 0.85 + Math.random() * 0.3;
      adjustedRatios[scoreKey] = baseVal * Math.max(factor, 0.1) * noise;
      sum += adjustedRatios[scoreKey];
    }

    const updatePromises = [];
    for (const opt of market.options) {
      const share = (adjustedRatios[opt.key] || 0.01) / sum;
      const stake = Math.max(Math.floor(targetTotal * share), 10); // 兜底每个选项 10 U 流动性
      distributedStake += stake;

      updatePromises.push(
        prisma.marketOption.update({
          where: { id: opt.id },
          data: {
            totalStake: String(stake),
            betCount: Math.floor(stake / (12 + Math.random() * 24)) + 1,
          },
        })
      );
    }
    await Promise.all(updatePromises);
  }

  // 写入市场表总池额
  await prisma.market.update({
    where: { id: marketId },
    data: { totalStake: String(distributedStake) },
  });

  console.log(`[liquidity] 自动为彩池 ${market.title} 自动注水 ${distributedStake} U，生成科学 odds`);
}
