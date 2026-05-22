/**
 * 数据库种子：创建管理员账号、示例比赛和市场
 * 运行：npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ============ 1. 创建管理员 ============
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      role: 'ADMIN',
      balanceUsdt: '0',
    },
  });
  console.log(`✓ 管理员账号: ${admin.username} / ${adminPassword}`);

  // ============ 2. 创建几个测试用户 ============
  for (const name of ['alice', 'bob', 'carol']) {
    const hash = await bcrypt.hash('test123456', 10);
    await prisma.user.upsert({
      where: { username: name },
      update: {},
      create: {
        username: name,
        passwordHash: hash,
        role: 'USER',
        balanceUsdt: '1000', // 测试余额 1000 U
      },
    });
  }
  console.log('✓ 测试用户: alice/bob/carol (密码: test123456)，各 1000 U 余额');

  // ============ 3. 示例比赛 ============
  const now = Date.now();
  const inOneHour = new Date(now + 60 * 60 * 1000);
  const inTwoHours = new Date(now + 2 * 60 * 60 * 1000);

  const match1 = await prisma.match.create({
    data: {
      competition: 'Premier League',
      homeTeam: 'Chelsea',
      awayTeam: 'Arsenal',
      kickoffAt: inOneHour,
      status: 'SCHEDULED',
    },
  });

  const market1 = await prisma.market.create({
    data: {
      matchId: match1.id,
      type: 'RESULT_1X2',
      title: `${match1.homeTeam} vs ${match1.awayTeam} - 全场胜平负`,
      description: '90 分钟（含补时）结果，加时赛与点球大战不计',
      lockAt: inOneHour,
      rakeBps: Number(process.env.PLATFORM_RAKE_BPS || 300),
      options: {
        create: [
          { key: 'HOME', label: `${match1.homeTeam} 胜` },
          { key: 'DRAW', label: '平局' },
          { key: 'AWAY', label: `${match1.awayTeam} 胜` },
        ],
      },
    },
  });
  console.log(`✓ 示例市场: ${market1.title}`);

  const match2 = await prisma.match.create({
    data: {
      competition: 'La Liga',
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      kickoffAt: inTwoHours,
      status: 'SCHEDULED',
    },
  });

  await prisma.market.create({
    data: {
      matchId: match2.id,
      type: 'RESULT_1X2',
      title: `${match2.homeTeam} vs ${match2.awayTeam} - 全场胜平负`,
      lockAt: inTwoHours,
      rakeBps: Number(process.env.PLATFORM_RAKE_BPS || 300),
      options: {
        create: [
          { key: 'HOME', label: `${match2.homeTeam} 胜` },
          { key: 'DRAW', label: '平局' },
          { key: 'AWAY', label: `${match2.awayTeam} 胜` },
        ],
      },
    },
  });
  console.log('✓ 示例市场 2 已创建');

  // ============ 4. 初始化扫块游标 ============
  await prisma.scanCursor.upsert({
    where: { id: 'bep20_usdt' },
    update: {},
    create: { id: 'bep20_usdt', lastBlockNumber: BigInt(0) },
  });

  console.log('\n🎉 种子数据初始化完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
