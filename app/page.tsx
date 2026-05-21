import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const stats = await Promise.all([
    prisma.market.count({ where: { status: 'OPEN' } }),
    prisma.bet.count(),
    prisma.user.count({ where: { role: 'USER' } }),
  ]);
  const upcoming = await prisma.market.findMany({
    where: { status: 'OPEN' },
    include: { match: true, options: true },
    orderBy: { lockAt: 'asc' },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <section className="card flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-2">⚽ 公司内部足彩预测平台</h1>
          <p className="opacity-70 text-sm">
            用 USDT 押注比赛胜平负，奖池模式自动结算。下注金额按胜方占比瓜分。
          </p>
        </div>
        <Link href="/markets" className="btn no-underline">
          浏览市场
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats[0]}</div>
          <div className="text-xs opacity-60 mt-1">进行中市场</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats[1]}</div>
          <div className="text-xs opacity-60 mt-1">累计下注</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold">{stats[2]}</div>
          <div className="text-xs opacity-60 mt-1">注册用户</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">即将开赛</h2>
        <div className="space-y-2">
          {upcoming.length === 0 && (
            <div className="card text-center opacity-60">暂无开放市场</div>
          )}
          {upcoming.map((m) => (
            <Link
              key={m.id}
              href={`/markets/${m.id}`}
              className="card flex items-center justify-between no-underline hover:border-brand-500"
            >
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-xs opacity-60 mt-1">
                  {m.match.competition} ·{' '}
                  {new Date(m.lockAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="opacity-60">奖池</div>
                <div className="font-bold">
                  {Number(m.totalStake).toFixed(2)} U
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
