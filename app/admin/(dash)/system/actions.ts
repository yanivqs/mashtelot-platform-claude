'use server';

import { requireUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email';
import { recordAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { retryFailedEmail } from '@/lib/email-outbox';

export interface TestEmailState {
  ok?: boolean;
  message?: string;
}

/** שליחת מייל בדיקה — מחזיר את תשובת Resend כפי שהיא, לאבחון. */
export async function sendTestEmail(
  _prev: TestEmailState,
  formData: FormData,
): Promise<TestEmailState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const to = String(formData.get('to') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, message: 'כתובת לא תקינה' };
  if (!(await rateLimit(`test-email:${user.id}`, 10, 10 * 60_000)).ok) {
    return { ok: false, message: 'יותר מדי ניסיונות, נסו שוב בעוד כמה דקות' };
  }

  const res = await sendEmail({
    to,
    subject: 'מייל בדיקה · מערכת המשתלות',
    html: '<div dir="rtl" style="font-family:Arial">זהו מייל בדיקה ממערכת המשתלות. אם קיבלתם אותו — שליחת המיילים תקינה ✓</div>',
  });
  await recordAudit({
    actorEmail: user.email,
    action: 'email.test',
    entityType: 'system',
    metadata: { to, ...res },
  });

  if (res.ok) return { ok: true, message: `נשלח בהצלחה (מזהה Resend: ${res.id ?? '—'})` };
  if (res.skipped) {
    return { ok: false, message: 'לא נשלח: RESEND_API_KEY או EMAIL_FROM לא מוגדרים בסביבת השרת' };
  }
  return { ok: false, message: res.error ?? 'שגיאה לא ידועה' };
}

/** §21: "שליחה חוזרת" למייל שנכשל סופית — חוזר לתור ונשלח בריצת הרקע הבאה. */
export async function retryEmailAction(formData: FormData): Promise<void> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  if (await retryFailedEmail(prisma, id)) {
    await recordAudit({ actorEmail: user.email, action: 'email.retry_requested', entityType: 'EmailJob', entityId: id });
  }
  revalidatePath('/admin/system');
}
