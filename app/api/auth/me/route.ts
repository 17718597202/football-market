import { getCurrentUser } from '@/lib/auth';
import { ok, err } from '@/lib/api';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return err('未登录', 401);
  return ok({
    id: user.id,
    username: user.username,
    role: user.role,
    balanceUsdt: user.balanceUsdt,
    frozenUsdt: user.frozenUsdt,
    tronAddress: user.tronAddress,
  });
}
