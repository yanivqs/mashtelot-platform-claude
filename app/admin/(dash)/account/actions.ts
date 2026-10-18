'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createSession, requireUser } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { changePassword } from '@/lib/account';
import { loginAuditEvent, LOGIN_ACTIONS, revokeUserSessions } from '@/lib/login';

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
}

/** מנפיק session חדש למכשיר הנוכחי אחרי העלאת גרסת ה-session (שאר המכשירים מנותקים). */
async function reissueCurrentSession(userId: string) {
  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, sessionVersion: true },
  });
  if (fresh) await createSession(fresh);
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

  await reissueCurrentSession(user.id);
  await recordAudit({
    nurseryId: user.nurseryId,
    actorEmail: user.email,
    action: 'auth.password_changed',
    entityType: 'User',
    entityId: user.id,
  });
  return { ok: true };
}

export interface RevokeSessionsState {
  ok?: boolean;
  error?: string;
}

/** "נתק את כל המכשירים האחרים" (SEC-02). */
export async function revokeOtherSessionsAction(
  _prev: RevokeSessionsState,
  _formData: FormData,
): Promise<RevokeSessionsState> {
  const user = await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER']);
  if (!rateLimit(`revoke-sessions:${user.id}`, 5, 15 * 60_000).ok) {
    return { error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' };
  }

  await revokeUserSessions(prisma, user.id);
  await reissueCurrentSession(user.id);
  await recordAudit(
    loginAuditEvent(LOGIN_ACTIONS.sessionsRevoked, {
      email: user.email,
      user,
      ctx: { ip: await clientIp(), userAgent: (await headers()).get('user-agent') },
    }),
  );
  return { ok: true };
}
