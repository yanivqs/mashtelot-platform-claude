'use server';

import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { changePassword } from '@/lib/account';

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
}

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER']);
  if (!rateLimit(`change-password:${user.id}`, 5, 15 * 60_000).ok) {
    return { error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' };
  }

  const res = await changePassword(prisma, user.id, {
    current: String(formData.get('current') || ''),
    next: String(formData.get('next') || ''),
    confirm: String(formData.get('confirm') || ''),
  });
  if (!res.ok) return { error: res.error };

  await recordAudit({
    nurseryId: user.nurseryId,
    actorEmail: user.email,
    action: 'auth.password_changed',
    entityType: 'User',
    entityId: user.id,
  });
  return { ok: true };
}
