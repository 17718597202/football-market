'use client';

import { useEffect, useState } from 'react';

export default function LocalTime({ date, locale }: { date: Date | string; locale?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return empty or a placeholder to avoid hydration mismatch
    return <span className="opacity-0">Loading...</span>;
  }

  const d = new Date(date);
  return (
    <span>
      {d.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </span>
  );
}
