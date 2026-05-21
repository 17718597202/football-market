import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Admin Navbar */}
      <nav className="bg-brand-900 border-b border-brand-800 p-4">
        <div className="max-w-5xl mx-auto flex items-center gap-6 overflow-x-auto">
          <Link href="/admin" className="font-bold text-lg whitespace-nowrap">
            YUCE Admin
          </Link>
          <Link href="/admin/users" className="opacity-80 hover:opacity-100 hover:text-brand-500 transition-colors whitespace-nowrap">
            用户管理
          </Link>
          <Link href="/admin/withdrawals" className="opacity-80 hover:opacity-100 hover:text-brand-500 transition-colors whitespace-nowrap">
            提现审核
          </Link>
          <Link href="/admin/markets" className="opacity-80 hover:opacity-100 hover:text-brand-500 transition-colors whitespace-nowrap">
            比赛市场
          </Link>
          <div className="flex-1"></div>
          <Link href="/" className="text-sm opacity-60 hover:opacity-100 whitespace-nowrap">
            返回前台
          </Link>
        </div>
      </nav>
      {/* Admin Content */}
      <main className="flex-1 p-4 max-w-5xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
