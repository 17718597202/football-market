import { getDictionary } from '@/lib/i18n';
import RegisterClient from './RegisterClient';

export default function RegisterPage() {
  const dict = getDictionary();
  return <RegisterClient dict={dict.auth} />;
}
