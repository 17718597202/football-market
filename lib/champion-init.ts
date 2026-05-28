import { prisma } from './db';

export async function ensureChampionMarket() {
  // 1. 检查虚拟比赛是否已经存在
  let match = await prisma.match.findUnique({
    where: { externalId: 'worldcup2026_champion' },
  });

  if (!match) {
    // 2. 创建虚拟比赛
    match = await prisma.match.create({
      data: {
        externalId: 'worldcup2026_champion',
        competition: 'FIFA World Cup 2026',
        homeTeam: '2026 World Cup',
        awayTeam: 'Champion Prediction',
        kickoffAt: new Date('2026-07-19T20:00:00Z'), // 世界杯决赛时间
        status: 'SCHEDULED',
      },
    });
  }

  // 3. 检查夺冠预测市场是否已经存在
  let market = await prisma.market.findFirst({
    where: {
      matchId: match.id,
      type: 'CHAMPION',
    },
    include: { options: true },
  });

  if (!market) {
    // 4. 创建夺冠预测市场及其 16 个夺冠热门选项
    market = await prisma.market.create({
      data: {
        matchId: match.id,
        type: 'CHAMPION',
        title: '2026年世界杯夺冠预测',
        description: '预测哪支球队将夺得2026年美加墨世界杯冠军。彩池结算规则：所有败方下注资金（扣除3%平台抽水）将按比例分配给胜方下注者。',
        lockAt: new Date('2026-07-19T20:00:00Z'),
        rakeBps: 300, // 3%
        options: {
          create: [
            { key: 'ARGENTINA', label: '阿根廷' },
            { key: 'FRANCE', label: '法国' },
            { key: 'BRAZIL', label: '巴西' },
            { key: 'ENGLAND', label: '英格兰' },
            { key: 'SPAIN', label: '西班牙' },
            { key: 'GERMANY', label: '德国' },
            { key: 'PORTUGAL', label: '葡萄牙' },
            { key: 'NETHERLANDS', label: '荷兰' },
            { key: 'ITALY', label: '意大利' },
            { key: 'BELGIUM', label: '比利时' },
            { key: 'URUGUAY', label: '乌拉圭' },
            { key: 'CROATIA', label: '克罗地亚' },
            { key: 'JAPAN', label: '日本' },
            { key: 'USA', label: '美国' },
            { key: 'MEXICO', label: '墨西哥' },
            { key: 'OTHER', label: '其他队伍' },
          ],
        },
      },
      include: { options: true },
    });
  }

  return { match, market };
}
