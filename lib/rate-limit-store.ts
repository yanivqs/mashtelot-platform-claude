import type { PrismaClient } from '@prisma/client';

/**
 * S-22: מונה הגבלת קצב משותף לכל מופעי השרת — טבלת `rate_limits` ב-Postgres.
 *
 * חלון קבוע (החלטת בעלים Q3-א): המונה מתאפס כשהחלון פג. כל קריאה היא שאילתה אטומית
 * אחת (`INSERT … ON CONFLICT DO UPDATE … RETURNING`), כך שבקשות מקבילות — גם ממופעים
 * שונים — לא "מפספסות" זו את זו. הזמן נלקח משעון ה-DB (אחיד לכל המופעים).
 * מופרד מ-`lib/rate-limit.ts` (server-only) כדי שיהיה בר-בדיקה מול בסיס נתונים.
 */

export interface RateLimitResult {
  ok: boolean;
  /** כמה בקשות נותרו בחלון הנוכחי */
  remaining: number;
  /** שניות עד שניתן לנסות שוב (כאשר ok=false) */
  retryAfter: number;
}

const MAX_KEY_LENGTH = 512;

export async function hitRateLimit(
  db: PrismaClient,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; retry_ms: number }[]>`
    INSERT INTO "rate_limits" ("key", "window_start", "count", "expires_at")
    VALUES (${key.slice(0, MAX_KEY_LENGTH)}, now(), 1, now() + ${windowMs} * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "count"        = CASE WHEN "rate_limits"."expires_at" <= now() THEN 1 ELSE "rate_limits"."count" + 1 END,
      "window_start" = CASE WHEN "rate_limits"."expires_at" <= now() THEN now() ELSE "rate_limits"."window_start" END,
      "expires_at"   = CASE WHEN "rate_limits"."expires_at" <= now() THEN EXCLUDED."expires_at" ELSE "rate_limits"."expires_at" END
    RETURNING "count",
      (EXTRACT(EPOCH FROM ("expires_at" - now())) * 1000)::float8 AS retry_ms`;

  const { count, retry_ms } = rows[0]!;
  if (count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil(retry_ms / 1000)) };
  }
  return { ok: true, remaining: limit - count, retryAfter: 0 };
}

/** מחיקת מונים שפג תוקפם (ניקוי — לא משפיע על נכונות, רק על גודל הטבלה). */
export async function purgeExpiredRateLimits(db: PrismaClient): Promise<number> {
  const res = await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return res.count;
}
