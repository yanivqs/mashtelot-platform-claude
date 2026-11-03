/**
 * תפוצת דואר של משתלה. נשמרת הסכמה מפורשת עם מועדה, והסרה נשמרת כדי שהכתובת לא תיוצא שוב.
 * מקבל את ה-DB כפרמטר (בר-בדיקה).
 */
import type { PrismaClient } from '@prisma/client';
import { csvCell } from '@/lib/crm';
import { normalizeEmail } from '@/lib/customer-otp';

export const SUBSCRIBERS_PER_PAGE = 50;

/** הרשמה חוזרת אחרי הסרה נחשבת להסכמה חדשה. */
export async function subscribeToNewsletter(db: PrismaClient, nurseryId: string, rawEmail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: 'כתובת אימייל לא תקינה' };
  const now = new Date();
  await db.newsletterSubscriber.upsert({
    where: { nurseryId_email: { nurseryId, email } },
    create: { nurseryId, email, consentAt: now },
    update: { consentAt: now, unsubscribedAt: null },
  });
  return { ok: true };
}

export async function removeSubscriber(db: PrismaClient, nurseryId: string, id: string): Promise<boolean> {
  const r = await db.newsletterSubscriber.updateMany({ where: { id, nurseryId, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } });
  return r.count > 0;
}

/** יצוא לכלי דיוור: רק מי שרשום כרגע. */
export async function exportSubscribersCsv(db: PrismaClient, nurseryId: string): Promise<{ csv: string; count: number }> {
  const rows = await db.newsletterSubscriber.findMany({ where: { nurseryId, unsubscribedAt: null }, orderBy: { consentAt: 'asc' } });
  const lines = rows.map((r) => [r.email, r.consentAt.toISOString().slice(0, 10)].map(csvCell).join(','));
  // BOM — כדי ש-Excel יציג עברית נכון
  return { csv: '﻿' + [['אימייל', 'תאריך הסכמה'].map(csvCell).join(','), ...lines].join('\r\n'), count: rows.length };
}
