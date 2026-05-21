import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SyncClient from './SyncClient';

export default async function SyncPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/login');
  return <SyncClient />;
}
