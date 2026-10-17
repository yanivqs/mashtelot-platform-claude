'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { canUseAdminPortal } from '@/lib/nursery-access';

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

  const user = await prisma.user.findUnique({ where: { email }, include: { nursery: true } });
  const ok =
    user?.passwordHash && (await verifyPassword(password, user.passwordHash));

  if (!user || !ok) {
    return { error: 'פרטי התחברות שגויים' };
  }

  const portal = canUseAdminPortal({
    role: user.role,
    nurseryId: user.nurseryId,
    nurseryActive: user.nursery ? user.nursery.isActive : null,
  });
  if (!portal.ok) return { error: portal.error };

  await createSession(user.id);
  redirect('/admin');
}
