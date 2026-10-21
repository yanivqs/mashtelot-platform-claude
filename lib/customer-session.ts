import 'server-only';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';

/**
 * Session של לקוח בחנות (R06-03) — נפרד לגמרי מ-session הניהול:
 * עוגייה אחרת, מפתח חתימה נגזר אחר, וסימון typ=customer + מזהה המשתלה.
 * העוגייה ללא Domain — שייכת רק לדומיין של החנות שבה התחבר הלקוח.
 */
const COOKIE = 'mashtelot_customer';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 יום

function key(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET must be set');
  return createHash('sha256').update(`customer-session:${s || 'dev-only-insecure-secret-change-me'}`).digest();
}

export async function createCustomerSession(c: { id: string; nurseryId: string; sessionVersion: number }): Promise<void> {
  const token = await new SignJWT({ sub: c.id, nid: c.nurseryId, sv: c.sessionVersion, typ: 'customer' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** הלקוח המחובר בחנות של `nurseryId`, או null (עוגייה של משתלה אחרת / session שבוטל — לא תקף). */
export async function getCustomer(nurseryId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.typ !== 'customer' || payload.nid !== nurseryId || typeof payload.sub !== 'string') return null;
    const c = await prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!c || c.nurseryId !== nurseryId || c.sessionVersion !== payload.sv) return null;
    return c;
  } catch {
    return null;
  }
}
