import { prisma } from '../lib/db';

async function main() {
  const users = await prisma.user.findMany();
  console.log(`=== 数据库用户列表 ===`);
  users.forEach((u) => {
    console.log(`👤 用户名: ${u.username}`);
    console.log(`   ID: ${u.id}`);
    console.log(`   角色: ${u.role}`);
    console.log(`   余额: ${u.balanceUsdt}`);
    console.log(`   密码哈希: ${u.passwordHash}`);
    console.log(`---`);
  });
}

main().then(() => process.exit(0));
