'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) {
      setErr(json.error);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-6">登录</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm opacity-70 block mb-1">用户名</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm opacity-70 block mb-1">密码</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button className="btn w-full" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </button>
        <div className="text-sm text-center opacity-70">
          还没账号？<Link href="/register">立即注册</Link>
        </div>
      </form>
    </div>
  );
}
