'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { clearMfaChallenge, createSession, readMfaChallenge } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { loginAuditEvent, LOGIN_ACTIONS, type LoginContext } from '@/lib/login';
import { verifyMfaCode } from '@/lib/mfa';

export interface MfaLoginState {
  error?: string;
}

/** שלב שני בהתחברות (§4.04): קוד מהאפליקציה או קוד שחזור → session עם סימון MFA. */
export async function verifyMfaLogin(_prev: MfaLoginState, formData: FormData): Promise<MfaLoginState> {
  const user = await readMfaChallenge();
  if (!user) redirect('/admin/login');

  const ctx: LoginContext = { ip: await clientIp(), userAgent: (await headers()).get('user-agent') };
  // הגבלת ניסיונות לפי משתמש (6 ספרות — ניחוש חסום), נפרדת מהגבלת הסיסמה
  if (!(await rateLimit(`mfa:user:${user.id}`, 5, 15 * 60_000)).ok) {
    if ((await rateLimit(`mfa-blocked-logged:${user.id}`, 1, 15 * 60_000)).ok) {
      await recordAudit(loginAuditEvent(LOGIN_ACTIONS.blocked, { email: user.email, user, reason: 'rate_limit_mfa', ctx }));
    }
    return { error: 'יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.' };
  }

  const res = await verifyMfaCode(prisma, user.id, String(formData.get('code') || ''));
  if (!res.ok) {
    await recordAudit(loginAuditEvent(LOGIN_ACTIONS.mfaFailed, { email: user.email, user, ctx }));
    return { error: res.error };
  }

  await recordAudit(loginAuditEvent(LOGIN_ACTIONS.success, { email: user.email, user, reason: res.method, ctx }));
  await clearMfaChallenge();
  await createSession(user, { mfa: true });
  redirect(res.method === 'recovery' ? '/admin/account?recovery=1' : '/admin');
}
