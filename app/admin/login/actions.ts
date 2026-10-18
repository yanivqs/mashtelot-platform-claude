'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { authenticateAdmin, loginAuditEvent, LOGIN_ACTIONS, type LoginContext } from '@/lib/login';

export interface LoginState {
  error?: string;
}

const TOO_MANY = 'יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות.';

const IP_WINDOW = 10 * 60_000;
const EMAIL_WINDOW = 15 * 60_000;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: 'יש להזין אימייל וסיסמה' };
  }

  const ctx: LoginContext = {
    ip: await clientIp(),
    userAgent: (await headers()).get('user-agent'),
  };

  // הגבלת קצב: לפי כתובת IP ולפי כתובת האימייל הנתקפת.
  // חסימה נרשמת ביומן פעם אחת לכל חלון — כדי שהתקפה לא תנפח את הטבלה (SEC-01).
  const limits = [
    { key: `login:ip:${ctx.ip}`, limit: 10, windowMs: IP_WINDOW, reason: 'rate_limit_ip' },
    { key: `login:email:${email}`, limit: 5, windowMs: EMAIL_WINDOW, reason: 'rate_limit_email' },
  ];
  for (const l of limits) {
    if (!rateLimit(l.key, l.limit, l.windowMs).ok) {
      if (rateLimit(`login-blocked-logged:${l.key}`, 1, l.windowMs).ok) {
        await recordAudit(loginAuditEvent(LOGIN_ACTIONS.blocked, { email, reason: l.reason, ctx }));
      }
      return { error: TOO_MANY };
    }
  }

  const res = await authenticateAdmin(prisma, email, password);
  if (!res.ok) {
    await recordAudit(
      loginAuditEvent(LOGIN_ACTIONS.failed, { email, user: res.user, reason: res.reason, ctx }),
    );
    return { error: res.error };
  }

  await recordAudit(loginAuditEvent(LOGIN_ACTIONS.success, { email, user: res.user, ctx }));
  await createSession(res.user);
  redirect('/admin');
}
