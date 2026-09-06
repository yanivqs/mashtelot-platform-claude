import 'server-only';
import { headers } from 'next/headers';

/**
 * מגביל קצב פשוט מבוסס חלון-זמן נע, בזיכרון התהליך.
 *
 * מספיק כדי לבלום ניסיונות brute-force / הצפת הזמנות מכתובת אחת.
 * הערה: המצב נשמר per-instance. ב-Vercel כל פונקציה serverless מריצה
 * מופע נפרד, כך שהספירה אינה גלובלית לחלוטין. אם צריך דיוק חוצה-אזורים
 * יש להחליף את ה-Map בחנות Redis (למשל Upstash) עם אותו חתום פונקציה.
 */

type Bucket = number[]; // חותמות זמן (ms) של בקשות בתוך החלון

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** ניקוי תקופתי של מפתחות שפג תוקפם כדי שה-Map לא יגדל ללא גבול. */
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** כמה בקשות נותרו בחלון הנוכחי */
  remaining: number;
  /** שניות עד שניתן לנסות שוב (כאשר ok=false) */
  retryAfter: number;
}

/**
 * רושם בקשה עבור `key` ומחזיר האם היא מותרת.
 * @param limit   מספר בקשות מותר בתוך החלון
 * @param windowMs אורך החלון במילישניות
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const oldest = hits[0];
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, hits);
    return { ok: false, remaining: 0, retryAfter };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, remaining: limit - hits.length, retryAfter: 0 };
}

/** כתובת ה-IP של הלקוח מתוך כותרות ה-proxy (Vercel). */
export function clientIp(): string {
  const h = headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip')?.trim() || 'unknown';
}
