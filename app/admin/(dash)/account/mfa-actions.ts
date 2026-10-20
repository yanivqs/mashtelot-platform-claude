'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { createSession, requireUser } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { loginAuditEvent, LOGIN_ACTIONS, type LoginAction } from '@/lib/login';
import { cancelEnrollment, confirmEnrollment, disableMfa, regenerateRecoveryCodes, resetMfaByAdmin, startEnrollment } from '@/lib/mfa';
import { mfaConfigured } from '@/lib/mfa-crypto';

export interface MfaState {
  ok?: boolean;
  error?: string;
  /** שלב 1: להצגה בלבד (המפתח שמור מוצפן בשרת) */
  qr?: string;
  secret?: string;
  /** מוצגים פעם אחת בלבד */
  recoveryCodes?: string[];
}

const ROLES = ['SUPER_ADMIN', 'NURSERY_OWNER'] as const;
const TOO_MANY = { error: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.' };

async function audit(user: { id: string; email: string; nurseryId: string | null }, action: LoginAction, reason?: string) {
  await recordAudit(
    loginAuditEvent(action, { email: user.email, user, reason, ctx: { ip: await clientIp(), userAgent: (await headers()).get('user-agent') } }),
  );
}

/** session חדש למכשיר הנוכחי אחרי שינוי שהעלה את גרסת ה-session. */
async function reissue(userId: string, mfa: boolean) {
  const fresh = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, sessionVersion: true } });
  if (fresh) await createSession(fresh, { mfa });
}

export async function startMfaAction(_prev: MfaState, _fd: FormData): Promise<MfaState> {
  const user = await requireUser([...ROLES]);
  if (!mfaConfigured()) return { error: 'אימות דו-שלבי עדיין לא הוגדר בשרת (MFA_ENCRYPTION_KEY) — פנו למנהל המערכת' };
  const r = await startEnrollment(prisma, user.id);
  if (!r.ok) return { error: r.error };
  const qr = await QRCode.toDataURL(r.uri, { margin: 1, width: 220 });
  return { qr, secret: r.secret };
}

export async function confirmMfaAction(prev: MfaState, fd: FormData): Promise<MfaState> {
  const user = await requireUser([...ROLES]);
  if (!(await rateLimit(`mfa-setup:${user.id}`, 10, 15 * 60_000)).ok) return { ...prev, ...TOO_MANY };
  const r = await confirmEnrollment(prisma, user.id, String(fd.get('code') || ''));
  // בשגיאה — ה-QR נשאר על המסך
  if (!r.ok) return { qr: prev.qr, secret: prev.secret, error: r.error };
  await reissue(user.id, true);
  await audit(user, LOGIN_ACTIONS.mfaEnabled);
  revalidatePath('/admin/account');
  return { ok: true, recoveryCodes: r.recoveryCodes };
}

export async function cancelMfaSetupAction(_prev: MfaState, _fd: FormData): Promise<MfaState> {
  const user = await requireUser([...ROLES]);
  await cancelEnrollment(prisma, user.id);
  return { ok: true };
}

export async function disableMfaAction(_prev: MfaState, fd: FormData): Promise<MfaState> {
  const user = await requireUser([...ROLES]);
  if (!(await rateLimit(`mfa:user:${user.id}`, 5, 15 * 60_000)).ok) return TOO_MANY;
  const r = await disableMfa(prisma, user.id, String(fd.get('code') || ''));
  if (!r.ok) {
    await audit(user, LOGIN_ACTIONS.mfaFailed, 'disable');
    return { error: r.error };
  }
  await reissue(user.id, false);
  await audit(user, LOGIN_ACTIONS.mfaDisabled);
  revalidatePath('/admin/account');
  return { ok: true };
}

export async function regenerateCodesAction(_prev: MfaState, fd: FormData): Promise<MfaState> {
  const user = await requireUser([...ROLES]);
  if (!(await rateLimit(`mfa:user:${user.id}`, 5, 15 * 60_000)).ok) return TOO_MANY;
  const r = await regenerateRecoveryCodes(prisma, user.id, String(fd.get('code') || ''));
  if (!r.ok) {
    await audit(user, LOGIN_ACTIONS.mfaFailed, 'regenerate');
    return { error: r.error };
  }
  await audit(user, LOGIN_ACTIONS.mfaRecoveryRegenerated);
  revalidatePath('/admin/account');
  return { ok: true, recoveryCodes: r.recoveryCodes };
}

/** סופר-אדמין: איפוס MFA למשתמש שאיבד את הטלפון (מנתק את כל המכשירים שלו). */
export async function resetUserMfaAction(_prev: MfaState, fd: FormData): Promise<MfaState> {
  const admin = await requireUser(['SUPER_ADMIN']);
  const r = await resetMfaByAdmin(prisma, String(fd.get('userId') || ''), admin.id);
  if (!r.ok) return { error: r.error };
  await recordAudit({
    nurseryId: r.nurseryId,
    actorEmail: admin.email,
    action: LOGIN_ACTIONS.mfaReset,
    entityType: 'User',
    entityId: String(fd.get('userId')),
    metadata: { targetEmail: r.email },
  });
  revalidatePath('/admin/nurseries');
  return { ok: true };
}
