import 'server-only';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hitRateLimit, purgeExpiredRateLimits, type RateLimitResult } from '@/lib/rate-limit-store';

export type { RateLimitResult };

/** הסתברות לניקוי מונים שפגו בכל קריאה (שומר על הטבלה קטנה בלי cron). */
const PURGE_PROBABILITY = 0.01;

/**
 * רושם בקשה עבור `key` ומחזיר האם היא מותרת. משותף לכל מופעי השרת (S-22).
 *
 * כשל בבדיקה עצמה (למשל תקלה רגעית ב-DB) — הבקשה מותרת ונרשמת שגיאה
 * (החלטת בעלים Q2-א: לא חוסמים לקוחות בגלל תקלה).
 * @param limit   מספר בקשות מותר בתוך החלון
 * @param windowMs אורך החלון במילישניות
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const res = await hitRateLimit(prisma, key, limit, windowMs);
    if (Math.random() < PURGE_PROBABILITY) {
      await purgeExpiredRateLimits(prisma).catch((e) => console.error('[rate-limit] ניקוי נכשל', e));
    }
    return res;
  } catch (e) {
    console.error('[rate-limit] בדיקת ההגבלה נכשלה — הבקשה מותרת', e);
    return { ok: true, remaining: limit, retryAfter: 0 };
  }
}

/** כתובת ה-IP של הלקוח מתוך כותרות ה-proxy (Vercel). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip')?.trim() || 'unknown';
}
