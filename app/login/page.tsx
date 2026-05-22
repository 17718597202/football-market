import { getDictionary } from '@/lib/i18n';
import LoginClient from './LoginClient';

export default function LoginPage() {
  const dict = getDictionary();
  return <LoginClient dict={dict.auth} />;
}
