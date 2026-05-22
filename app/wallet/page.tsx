import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import WalletClient from './WalletClient';
import { getDictionary } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const dict = getDictionary();
  const txs = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const wds = await prisma.withdrawal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <WalletClient
      user={{
        balance: user.balanceUsdt,
        frozen: user.frozenUsdt,
        bscAddress: user.bscAddress,
      }}
      hotWallet={process.env.HOT_WALLET_ADDRESS || '（未配置，请管理员设置）'}
      minWithdraw={process.env.MIN_WITHDRAW_USDT || '10'}
      transactions={txs.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      }))}
      withdrawals={wds.map((w) => ({
        ...w,
        createdAt: w.createdAt.toISOString(),
        reviewedAt: w.reviewedAt?.toISOString() || null,
      }))}
      dict={dict.wallet}
    />
  );
}
