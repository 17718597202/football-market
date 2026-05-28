import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';
import BetSlip from '@/app/components/BetSlip';
import { getDictionary, getLocale } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export const metadata: Metadata = {
  title: '2026 World Cup Prediction Market',
  description: 'Global Football Prediction Platform',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const dict = getDictionary();
  const locale = getLocale();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between sticky top-0 backdrop-blur-md bg-[rgba(2,11,7,.85)] z-10">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold no-underline">
              {dict.nav.title}
            </Link>
            <Link href="/markets" className="text-sm no-underline opacity-80 hover:opacity-100">
              {dict.nav.markets}
            </Link>
            <Link href="/champion" className="text-sm no-underline opacity-90 hover:opacity-100 text-[#eab308] font-bold flex items-center gap-1">
              🏆 {dict.nav.champion}
            </Link>
            <Link href="/me/bets" className="text-sm no-underline opacity-80 hover:opacity-100">
              {dict.nav.myBets}
            </Link>
            <Link href="/wallet" className="text-sm no-underline opacity-80 hover:opacity-100">
              {dict.nav.wallet}
            </Link>
            {user?.role === 'ADMIN' && (
              <Link href="/admin" className="text-sm no-underline text-yellow-400">
                {dict.nav.admin}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <LanguageSwitcher currentLocale={locale} />
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
                  {dict.nav.login}
                </Link>
                <Link href="/register" className="no-underline">
                  {dict.nav.register}
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
