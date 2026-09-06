'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export interface LoginState {
  error?: string;
}

const TOO_MANY = 'יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות.';

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { error: 'יש להזין אימייל וסיסמה' };
  }

  // הגבלת קצב: לפי כתובת IP ולפי כתובת האימייל הנתקפת
  const ip = clientIp();
  if (!rateLimit(`login:ip:${ip}`, 10, 10 * 60_000).ok) return { error: TOO_MANY };
  if (!rateLimit(`login:email:${email}`, 5, 15 * 60_000).ok) return { error: TOO_MANY };

  const user = await prisma.user.findUnique({ where: { email } });
  const ok =
    user?.passwordHash && (await verifyPassword(password, user.passwordHash));

  if (!user || !ok) {
    return { error: 'פרטי התחברות שגויים' };
  }

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'NURSERY_OWNER') {
    return { error: 'אין לך הרשאת גישה לפורטל הניהול' };
  }

  await createSession(user.id);
  redirect('/admin');
}
