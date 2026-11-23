'use server';

import { prisma } from '@/lib/prisma';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { escapeHtml, sendEmail } from '@/lib/email';
import { sendViaOutbox } from '@/lib/email-outbox';
import { getPlatformContact } from '@/lib/nursery-account';
import { validateLead } from '@/lib/platform-lead';

export interface LeadState {
  ok?: boolean;
  error?: string;
}

/**
 * טופס "צור קשר" בדף הנחיתה: מייל לכתובת הקשר של הפלטפורמה, דרך תור המיילים (ניסיון חוזר אם נכשל,
 * וגלוי ב"מיילים ומערכת"). תשובה למייל מגיעה ישר לפונה.
 */
export async function submitPlatformLead(_prev: LeadState, fd: FormData): Promise<LeadState> {
  // שדה מלכודת שאנשים לא רואים: בוט שממלא אותו מקבל הצלחה והפנייה לא נשלחת
  if (String(fd.get('website') || '')) return { ok: true };
  const parsed = validateLead(Object.fromEntries(fd));
  if (!parsed.ok) return { error: parsed.error };
  if (!(await rateLimit(`platform-lead:ip:${await clientIp()}`, 5, 15 * 60_000)).ok) return { error: 'יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.' };

  const { lead } = parsed;
  const to = (await getPlatformContact()).email;
  const row = (label: string, value: string) => `<tr><td style="padding:4px 8px;color:#555">${label}</td><td style="padding:4px 8px">${escapeHtml(value) || '—'}</td></tr>`;
  const res = await sendViaOutbox(
    prisma,
    {
      kind: 'platform_lead',
      to,
      replyTo: lead.email,
      subject: `פנייה חדשה מאתר הפלטפורמה: ${lead.nurseryName}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif">
        <p>התקבלה פנייה מטופס "צור קשר" בדף הבית של הפלטפורמה.</p>
        <table style="border-collapse:collapse">
          ${row('שם איש קשר', lead.contactName)}
          ${row('שם המשתלה', lead.nurseryName)}
          ${row('טלפון', lead.phone)}
          ${row('מייל', lead.email)}
        </table>
        ${lead.notes ? `<p style="white-space:pre-line">${escapeHtml(lead.notes)}</p>` : ''}
        <p style="color:#555">אפשר להשיב ישירות למייל הזה — התשובה תגיע לפונה.</p>
      </div>`,
    },
    sendEmail,
  ).catch(() => null);
  // הפנייה נרשמה בתור גם אם השליחה המיידית נכשלה; רק כשל ברישום עצמו מוצג לפונה
  if (!res) return { error: 'השליחה נכשלה. נסו שוב, או כתבו לנו במייל.' };
  return { ok: true };
}
