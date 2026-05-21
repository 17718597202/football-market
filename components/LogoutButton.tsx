'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-xs opacity-60 hover:opacity-100 bg-transparent border-0 cursor-pointer"
    >
      退出
    </button>
  );
}
