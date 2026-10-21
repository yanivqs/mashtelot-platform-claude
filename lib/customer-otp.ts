/**
 * התחברות לקוח בקוד חד-פעמי במייל (R06-03). מקבל את ה-DB כפרמטר (בר-בדיקה).
 * - קוד בן 6 ספרות, תקף 10 דקות; קוד חדש מבטל קודים קודמים של אותו מייל.
 * - נשמר רק HMAC(AUTH_SECRET) של הקוד, קשור למשתלה ולמייל — דליפת DB לא חושפת קודים.
 * - עד 5 ניסיונות לקוד; אימות מסמן את הקוד כנוצל באופן מותנה (אין שימוש כפול גם במקביל).
 * - אימות מוצלח = המייל אומת: נוצר/נטען הלקוח, והזמנות אורח קודמות עם אותו מייל במשתלה משויכות אליו.
 */
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import type { Customer, PrismaClient } from '@prisma/client';

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET must be set');
  return s || 'dev-only-insecure-secret-change-me';
}

export function hashOtp(nurseryId: string, email: string, code: string): string {
  return createHmac('sha256', secret()).update(`customer-otp:${nurseryId}:${email}:${code}`).digest('hex');
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** קוד חדש (הקודמים של אותו מייל מבוטלים). מחזיר את הקוד לשליחה במייל — לא נשמר בגלוי. */
export async function issueOtp(db: PrismaClient, nurseryId: string, email: string, now = new Date()): Promise<string> {
  const code = generateOtpCode();
  await db.$transaction([
    db.customerOtp.updateMany({ where: { nurseryId, email, consumedAt: null }, data: { consumedAt: now } }),
    db.customerOtp.create({ data: { nurseryId, email, codeHash: hashOtp(nurseryId, email, code), expiresAt: new Date(now.getTime() + OTP_TTL_MS) } }),
  ]);
  return code;
}

export type VerifyOtpResult = { ok: true; customer: Customer; created: boolean; claimedOrders: number } | { ok: false; error: string };

const BAD = 'הקוד שגוי או שפג תוקפו — בקשו קוד חדש';

export async function verifyOtp(db: PrismaClient, nurseryId: string, email: string, code: string, now = new Date()): Promise<VerifyOtpResult> {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return { ok: false, error: BAD };
  const otp = await db.customerOtp.findFirst({
    where: { nurseryId, email, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: BAD };

  const match = timingSafeEqual(Buffer.from(otp.codeHash, 'hex'), Buffer.from(hashOtp(nurseryId, email, c), 'hex'));
  if (!match) {
    await db.customerOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: BAD };
  }

  return db.$transaction(async (tx) => {
    const used = await tx.customerOtp.updateMany({
      where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { consumedAt: now },
    });
    if (used.count !== 1) return { ok: false as const, error: BAD };
    const existing = await tx.customer.findUnique({ where: { nurseryId_email: { nurseryId, email } } });
    const customer = existing
      ? await tx.customer.update({ where: { id: existing.id }, data: { lastLoginAt: now } })
      : await tx.customer.create({ data: { nurseryId, email, lastLoginAt: now } });
    // הזמנות אורח של אותו מייל במשתלה הזו — המייל אומת, ולכן הן של הלקוח
    const claimed = await tx.order.updateMany({
      where: { nurseryId, customerId: null, customerEmail: { equals: email, mode: 'insensitive' } },
      data: { customerId: customer.id },
    });
    return { ok: true as const, customer, created: !existing, claimedOrders: claimed.count };
  });
}
