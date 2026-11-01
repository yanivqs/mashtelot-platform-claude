/**
 * קישור תצוגה מקדימה למוצר מוסתר: האדמין והחנות יושבים על דומיינים שונים (אין עוגיית התחברות משותפת),
 * לכן הקישור נושא חתימת HMAC(AUTH_SECRET) על מזהה המוצר + תוקף. בלי חתימה תקפה — 404.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export const PREVIEW_TTL_MS = 24 * 60 * 60_000;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET must be set');
  return s || 'dev-only-insecure-secret-change-me';
}

function sign(productId: string, exp: number): string {
  return createHmac('sha256', secret()).update(`product-preview:${productId}:${exp}`).digest('base64url');
}

/** טוקן בפורמט `<exp>.<sig>` — תקף 24 שעות. */
export function createPreviewToken(productId: string, now = Date.now()): string {
  const exp = now + PREVIEW_TTL_MS;
  return `${exp}.${sign(productId, exp)}`;
}

export function verifyPreviewToken(productId: string, token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!sig || !Number.isSafeInteger(exp) || exp < now) return false;
  const expected = Buffer.from(sign(productId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** נתיב התצוגה המקדימה בחנות (יחסי לדומיין המשתלה). */
export function productPreviewPath(productId: string, now = Date.now()): string {
  return `/preview/product/${productId}?t=${encodeURIComponent(createPreviewToken(productId, now))}`;
}

/** קישור "צפייה" מהניהול: מוצר מוצג — הדף הציבורי; מוסתר — תצוגה מקדימה חתומה. */
export function adminProductViewUrl(origin: string, p: { id: string; slug: string; visible: boolean }, now = Date.now()): string {
  return p.visible ? `${origin}/product/${encodeURIComponent(p.slug)}` : `${origin}${productPreviewPath(p.id, now)}`;
}
