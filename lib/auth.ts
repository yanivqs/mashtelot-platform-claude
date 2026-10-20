import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isSessionAllowed } from '@/lib/nursery-access';
import { isTokenVersionCurrent } from '@/lib/login';

const SESSION_COOKIE = 'mashtelot_session';
/** §4.04: אחרי סיסמה נכונה, לפני קוד האימות — 5 דקות */
const MFA_COOKIE = 'mashtelot_mfa';
const MFA_MAX_AGE = 5 * 60;
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me',
);

if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('AUTH_SECRET must be set in production');
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * מנפיק session. `sv` = גרסת ה-session של המשתמש (SEC-02) — העלאתה מבטלת את ה-session.
 * `mfa` — עבר אימות דו-שלבי; למשתמש עם MFA פעיל, session בלי הסימון אינו תקף.
 */
export async function createSession(user: { id: string; sessionVersion: number }, opts: { mfa?: boolean } = {}): Promise<void> {
  const token = await new SignJWT({ sub: user.id, sv: user.sessionVersion, ...(opts.mfa ? { mfa: true } : {}) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** אתגר MFA: הסיסמה אומתה, ממתינים לקוד. אינו session — לא נותן גישה לשום דף. */
export async function createMfaChallenge(user: { id: string; sessionVersion: number }): Promise<void> {
  const token = await new SignJWT({ sub: user.id, sv: user.sessionVersion, purpose: 'mfa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MFA_MAX_AGE}s`)
    .sign(secret);
  (await cookies()).set(MFA_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin/login',
    maxAge: MFA_MAX_AGE,
  });
}

/** המשתמש שממתין לקוד (אתגר תקף, וגרסת ה-session לא השתנתה), או null. */
export async function readMfaChallenge() {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== 'mfa' || !payload.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { nursery: true } });
    if (!user || !isTokenVersionCurrent(payload.sv, user.sessionVersion) || !user.mfaEnabledAt) return null;
    return user;
  } catch {
    return null;
  }
}

export async function clearMfaChallenge(): Promise<void> {
  (await cookies()).set(MFA_COOKIE, '', { path: '/admin/login', maxAge: 0 });
}

/** Current authenticated user (with nursery), or null. Cached per request. */
export const getSessionUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { nursery: true },
    });
    // session שבוטל (החלפת סיסמה / "נתק את כל המכשירים") — SEC-02
    if (user && !isTokenVersionCurrent(payload.sv, user.sessionVersion)) return null;
    // §4.04: משתמש עם MFA פעיל — רק session שעבר את הקוד
    if (user?.mfaEnabledAt && payload.mfa !== true) return null;
    // בעלים של משתלה מושעית — ה-session מבוטל מיד (C-P1-01, אפיון §2.03)
    if (
      user &&
      !isSessionAllowed({
        role: user.role,
        nurseryId: user.nurseryId,
        nurseryActive: user.nursery ? user.nursery.isActive : null,
        disabled: Boolean(user.disabledAt),
      })
    ) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
});

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** Require an authenticated user in one of `roles` (any role if omitted). */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (roles && !roles.includes(user.role)) redirect('/admin');
  return user;
}
