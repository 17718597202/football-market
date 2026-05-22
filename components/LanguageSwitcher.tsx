'use client';

import { useRouter } from 'next/navigation';

export default function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();

  const toggle = () => {
    const newLocale = currentLocale === 'zh' ? 'en' : 'zh';
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    router.refresh();
  };

  return (
    <button 
      onClick={toggle} 
      className="text-sm font-medium opacity-80 hover:opacity-100 bg-[var(--border)] px-2 py-1 rounded"
    >
      {currentLocale === 'zh' ? 'EN' : '中'}
    </button>
  );
}
