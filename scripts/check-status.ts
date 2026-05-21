import { prisma } from '../lib/db';

async function main() {
  const matches = await prisma.match.findMany({
    take: 10,
    orderBy: { kickoffAt: 'asc' },
    include: { markets: true },
  });

  console.log(`=== 数据库最新赛程状态 ===`);
  matches.forEach((m) => {
    console.log(`⚽ 比赛: ${m.homeTeam} vs ${m.awayTeam}`);
    console.log(`   ID: ${m.id}`);
    console.log(`   状态: ${m.status}`);
    console.log(`   开赛时间: ${m.kickoffAt}`);
    m.markets.forEach((mk) => {
      console.log(`   └─ 市场: ${mk.title} | 状态: ${mk.status} | 锁单时间: ${mk.lockAt}`);
    });
  });
}

main().then(() => process.exit(0));
