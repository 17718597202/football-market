'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    const res = await fetch('/api/auth/register', {
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
      <h1 className="text-2xl font-bold mb-6">注册</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm opacity-70 block mb-1">用户名</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="3-32 位字母/数字/下划线"
          />
        </div>
        <div>
          <label className="text-sm opacity-70 block mb-1">密码</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
          />
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button className="btn w-full" disabled={loading}>
          {loading ? '注册中...' : '注册并登录'}
        </button>
        <div className="text-sm text-center opacity-70">
          已有账号？<Link href="/login">直接登录</Link>
        </div>
      </form>
    </div>
  );
}
