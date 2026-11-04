'use server';

import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { createAccessibilityReport, validateReport } from '@/lib/accessibility';
import { escapeHtml, orderNotificationRecipients, sendEmail } from '@/lib/email';

export interface ReportState {
  ok?: boolean;
  error?: string;
}

/** דיווח מהחנות. הפנייה נשמרת גם אם המייל לבעל המשתלה נכשל, והיא מופיעה במסך הנגישות. */
export async function submitAccessibilityReport(_prev: ReportState, fd: FormData): Promise<ReportState> {
  // שדה מלכודת שאנשים לא רואים: בוט שממלא אותו מקבל הצלחה והפנייה לא נשמרת
  if (String(fd.get('website') || '')) return { ok: true };
  const nursery = await getNurseryByTenant(String(fd.get('tenant') || ''));
  if (!nursery) return { error: 'החנות לא נמצאה' };
  const parsed = validateReport({
    description: fd.get('description'),
    pageUrl: fd.get('pageUrl'),
    contactName: fd.get('contactName'),
    contactEmail: fd.get('contactEmail'),
    contactPhone: fd.get('contactPhone'),
  });
  if (!parsed.ok) return { error: parsed.error };
  if (!(await rateLimit(`a11y-report:ip:${await clientIp()}`, 5, 15 * 60_000)).ok) return { error: 'יותר מדי ניסיונות. נסו שוב בעוד מספר דקות, או פנו אלינו בטלפון.' };

  const report = await createAccessibilityReport(prisma, nursery.id, parsed.input);
  const { input } = parsed;
  await sendEmail({
    to: orderNotificationRecipients(nursery),
    subject: `פנייה חדשה בנושא נגישות: ${nursery.name}`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif">
      <p>התקבלה פנייה בנושא נגישות באתר. לפי התקנות יש לתקן בתוך 60 ימים מיום ההודעה.</p>
      <p style="white-space:pre-line">${escapeHtml(input.description)}</p>
      ${input.pageUrl ? `<p>עמוד: ${escapeHtml(input.pageUrl)}</p>` : ''}
      <p>פרטי הפונה: ${escapeHtml([input.contactName, input.contactEmail, input.contactPhone].filter(Boolean).join(' · '))}</p>
      <p>מספר פנייה: ${escapeHtml(report.id.slice(0, 8))}. הטיפול במסך "נגישות" בניהול החנות.</p>
    </div>`,
  }).catch(() => undefined);
  return { ok: true };
}
