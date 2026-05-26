import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db';

async function main() {
  const username = process.argv[2] || 'admin';
  const newPassword = process.argv[3] || 'admin123456';

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user) {
    console.error(`❌ 用户 "${username}" 不存在！`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash }
  });

  console.log(`✅ 成功重置用户 "${username}" 的密码为: "${newPassword}"`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
