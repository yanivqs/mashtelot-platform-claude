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

/** מנפיק session. `sv` = גרסת ה-session של המשתמש (SEC-02) — העלאתה מבטלת את ה-session. */
export async function createSession(user: { id: string; sessionVersion: number }): Promise<void> {
  const token = await new SignJWT({ sub: user.id, sv: user.sessionVersion })
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
    // בעלים של משתלה מושעית — ה-session מבוטל מיד (C-P1-01, אפיון §2.03)
    if (
      user &&
      !isSessionAllowed({
        role: user.role,
        nurseryId: user.nurseryId,
        nurseryActive: user.nursery ? user.nursery.isActive : null,
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
