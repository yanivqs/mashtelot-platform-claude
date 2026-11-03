'use server';

import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { subscribeToNewsletter } from '@/lib/newsletter';

export interface NewsletterState {
  ok?: boolean;
  error?: string;
}

/** הרשמה מהחנות. התשובה זהה לכתובת חדשה ולכתובת קיימת, כדי לא לחשוף מי רשום. */
export async function subscribeAction(_prev: NewsletterState, fd: FormData): Promise<NewsletterState> {
  // שדה מלכודת שאנשים לא רואים: בוט שממלא אותו מקבל הצלחה ולא נרשם
  if (String(fd.get('website') || '')) return { ok: true };
  if (fd.get('consent') !== 'on') return { error: 'כדי להירשם יש לאשר קבלת דיוור' };
  const nursery = await getNurseryByTenant(String(fd.get('tenant') || ''));
  if (!nursery || !(await isModuleEnabled(nursery.id, 'newsletter'))) return { error: 'ההרשמה אינה זמינה בחנות זו' };
  if (!(await rateLimit(`newsletter:ip:${await clientIp()}`, 10, 15 * 60_000)).ok) return { error: 'יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.' };
  const res = await subscribeToNewsletter(prisma, nursery.id, String(fd.get('email') || ''));
  return res.ok ? { ok: true } : { error: res.error };
}
