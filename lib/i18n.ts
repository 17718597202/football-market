import { cookies } from 'next/headers';
import zh from '../messages/zh.json';
import en from '../messages/en.json';

export type Locale = 'zh' | 'en';
export type Dictionary = typeof zh;

export function getLocale(): Locale {
  const cookieStore = cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value;
  return locale === 'en' ? 'en' : 'zh';
}

export function getDictionary(): Dictionary {
  const locale = getLocale();
  return locale === 'en' ? en : zh;
}
