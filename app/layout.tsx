import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';
import BetSlip from '@/app/components/BetSlip';

export const metadata: Metadata = {
  title: '足球预测市场',
  description: '内部足彩预测平台 - MVP',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="zh">
      <body>
        <nav className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between sticky top-0 backdrop-blur bg-[rgba(11,18,32,.85)] z-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold no-underline">
              ⚽ 足彩预测
            </Link>
            <Link href="/markets" className="text-sm no-underline opacity-80 hover:opacity-100">
              市场
            </Link>
            <Link href="/me/bets" className="text-sm no-underline opacity-80 hover:opacity-100">
              我的下注
            </Link>
            <Link href="/wallet" className="text-sm no-underline opacity-80 hover:opacity-100">
              钱包
            </Link>
            {user?.role === 'ADMIN' && (
              <Link href="/admin" className="text-sm no-underline text-yellow-400">
                管理后台
              </Link>
            )}
          </div>
          <div className="text-sm">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="opacity-70">{user.username}</span>
                <span className="tag tag-green">
                  {Number(user.balanceUsdt).toFixed(2)} U
                </span>
                <LogoutButton />
              </div>
            ) : (
              <div className="flex gap-3">
                <Link href="/login" className="no-underline">
                  登录
                </Link>
                <Link href="/register" className="no-underline">
                  注册
                </Link>
              </div>
            )}
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
        <BetSlip />
      </body>
    </html>
  );
}
