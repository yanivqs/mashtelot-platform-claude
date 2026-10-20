import bcrypt from 'bcryptjs';
import type { PrismaClient, User } from '@prisma/client';
import { canUseAdminPortal } from '@/lib/nursery-access';

/**
 * אימות התחברות לפורטל הניהול ובניית רשומת יומן ההתחברויות (SEC-01).
 * מופרד מה-Server Action כדי שיהיה בר-בדיקה מול בסיס נתונים.
 * הסיסמה לעולם אינה נרשמת.
 */

export type LoginFailureReason = 'unknown_email' | 'bad_password' | 'portal_denied';

export type AuthenticateResult =
  | { ok: true; user: User }
  | { ok: false; reason: LoginFailureReason; error: string; user: User | null };

const BAD_CREDENTIALS = 'פרטי התחברות שגויים';

export async function authenticateAdmin(
  db: PrismaClient,
  email: string,
  password: string,
): Promise<AuthenticateResult> {
  const user = await db.user.findUnique({ where: { email }, include: { nursery: true } });
  if (!user) return { ok: false, reason: 'unknown_email', error: BAD_CREDENTIALS, user: null };
  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, reason: 'bad_password', error: BAD_CREDENTIALS, user };
  }

  const portal = canUseAdminPortal({
    role: user.role,
    nurseryId: user.nurseryId,
    nurseryActive: user.nursery ? user.nursery.isActive : null,
    disabled: Boolean(user.disabledAt),
  });
  if (!portal.ok) return { ok: false, reason: 'portal_denied', error: portal.error, user };

  return { ok: true, user };
}

export const LOGIN_ACTIONS = {
  success: 'auth.login_success',
  failed: 'auth.login_failed',
  blocked: 'auth.login_blocked',
  logout: 'auth.logout',
  sessionsRevoked: 'auth.sessions_revoked',
  /** §4.04: סיסמה נכונה, ממתין לקוד אימות */
  mfaChallenge: 'auth.mfa_challenge',
  mfaFailed: 'auth.mfa_failed',
  mfaEnabled: 'auth.mfa_enabled',
  mfaDisabled: 'auth.mfa_disabled',
  mfaReset: 'auth.mfa_reset',
  mfaRecoveryRegenerated: 'auth.mfa_recovery_regenerated',
} as const;

export type LoginAction = (typeof LOGIN_ACTIONS)[keyof typeof LOGIN_ACTIONS];
export const LOGIN_ACTION_VALUES = Object.values(LOGIN_ACTIONS) as LoginAction[];

export interface LoginContext {
  ip: string;
  userAgent: string | null;
}

/** רשומת audit_events לאירוע התחברות. האימייל נשמר כפי שהוקלד (מנורמל וחתוך). */
export function loginAuditEvent(
  action: LoginAction,
  input: {
    email: string;
    user?: Pick<User, 'id' | 'nurseryId'> | null;
    reason?: string;
    ctx: LoginContext;
  },
) {
  return {
    nurseryId: input.user?.nurseryId ?? null,
    actorEmail: input.email.slice(0, 254) || null,
    action,
    entityType: 'User',
    entityId: input.user?.id ?? null,
    metadata: {
      ip: input.ctx.ip.slice(0, 64),
      userAgent: input.ctx.userAgent ? input.ctx.userAgent.slice(0, 200) : null,
      ...(input.reason ? { reason: input.reason } : {}),
    },
  };
}

/**
 * SEC-02: האם גרסת ה-session שב-JWT תואמת לגרסה הנוכחית של המשתמש.
 * JWT שהונפק לפני SEC-02 אינו מכיל גרסה — נחשב לגרסה 0 (אין ניתוק בעת הפריסה).
 */
export function isTokenVersionCurrent(tokenVersion: unknown, userVersion: number): boolean {
  const v = tokenVersion === undefined ? 0 : tokenVersion;
  return typeof v === 'number' && Number.isInteger(v) && v === userVersion;
}

/**
 * SEC-02: מבטל את כל ה-sessions של המשתמש (מעלה את גרסת ה-session) ומחזיר את הגרסה
 * החדשה — כדי שהקורא יוכל להנפיק session חדש למכשיר הנוכחי.
 */
export async function revokeUserSessions(db: PrismaClient, userId: string): Promise<number> {
  const user = await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return user.sessionVersion;
}
