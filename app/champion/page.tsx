import { ensureChampionMarket } from '@/lib/champion-init';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary, getLocale } from '@/lib/i18n';
import { prisma } from '@/lib/db';
import ChampionClient from './ChampionClient';

export const dynamic = 'force-dynamic';

export default async function ChampionPage() {
  // 1. 确保夺冠预测比赛和市场已经存在于数据库中
  const { market: seededMarket } = await ensureChampionMarket();

  // 2. 重新从数据库拉取最新的市场及选项（含最新的下注额）
  const market = await prisma.market.findUnique({
    where: { id: seededMarket.id },
    include: {
      options: { orderBy: { totalStake: 'desc' } }, // 按下注金额降序排列，方便展示热门程度
      match: true,
    },
  });

  if (!market) {
    throw new Error('Failed to load champion market');
  }

  // 3. 获取当前用户及可用余额
  const user = await getCurrentUser();

  // 4. 获取当前用户在此市场下的所有下注历史
  const myBets = user
    ? await prisma.bet.findMany({
        where: { marketId: market.id, userId: user.id },
        include: { option: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const dict = getDictionary();
  const locale = getLocale();

  return (
    <ChampionClient
      market={{
        id: market.id,
        title: market.title,
        description: market.description || '',
        status: market.status,
        totalStake: market.totalStake,
        rakeBps: market.rakeBps,
        winningKey: market.winningKey,
        lockAt: market.lockAt.toISOString(),
        options: market.options.map((o) => ({
          id: o.id,
          key: o.key,
          label: o.label,
          totalStake: o.totalStake,
          betCount: o.betCount,
        })),
      }}
      loggedIn={!!user}
      balance={user?.balanceUsdt || '0'}
      myBets={myBets.map((b) => ({
        id: b.id,
        amount: b.amount,
        status: b.status,
        payout: b.payout,
        createdAt: b.createdAt.toISOString(),
        optionLabel: b.option.label,
        optionKey: b.option.key,
      }))}
      locale={locale}
      dict={dict}
    />
  );
}
