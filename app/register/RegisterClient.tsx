'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterClient({ dict }: { dict: any }) {
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
      <h1 className="text-2xl font-bold mb-6">{dict.register}</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm opacity-70 block mb-1">{dict.username}</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="3-32 chars"
          />
        </div>
        <div>
          <label className="text-sm opacity-70 block mb-1">{dict.password}</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 chars"
          />
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button className="btn w-full" disabled={loading}>
          {loading ? '...' : dict.register}
        </button>
        <div className="text-sm text-center opacity-70">
          <Link href="/login">{dict.hasAccount}</Link>
        </div>
      </form>
    </div>
  );
}
