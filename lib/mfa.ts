/**
 * אימות דו-שלבי (§4.04) — הפעלה, אימות בהתחברות, קודי שחזור, ביטול ואיפוס. מקבל את ה-DB כפרמטר.
 * החלטת בעלים (2026-10-20): MFA אופציונלי לכל המשתמשים, כולל סופר-אדמין (חריגה מ-§4.04 — מתועדת).
 *
 * - ההפעלה בשני שלבים: מפתח נשמר מוצפן כ"ממתין", ומופעל רק אחרי קוד תקף מהאפליקציה.
 * - קוד TOTP נוצל → הצעד נשמר באופן מותנה (אין שימוש חוזר, גם בבקשות מקבילות).
 * - קוד שחזור — חד-פעמי (סימון מותנה ב-used_at IS NULL).
 * - הפעלה/ביטול/איפוס מעלים את גרסת ה-session: שאר המכשירים מנותקים.
 */
import type { PrismaClient } from '@prisma/client';
import { generateSecret, otpauthUri, verifyTotp } from '@/lib/totp';
import { decryptSecret, encryptSecret, generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from '@/lib/mfa-crypto';

export const MFA_ISSUER = 'משתלות';

export type MfaResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** שלב 1: מפתח חדש (מחליף הפעלה ממתינה קודמת). אי אפשר כשה-MFA כבר פעיל. */
export async function startEnrollment(db: PrismaClient, userId: string): Promise<MfaResult<{ secret: string; uri: string }>> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, mfaEnabledAt: true } });
  if (!user) return { ok: false, error: 'המשתמש לא נמצא' };
  if (user.mfaEnabledAt) return { ok: false, error: 'האימות הדו-שלבי כבר פעיל' };
  const secret = generateSecret();
  await db.user.update({ where: { id: userId }, data: { mfaSecretEnc: encryptSecret(secret), mfaLastStep: null } });
  return { ok: true, secret, uri: otpauthUri(secret, user.email, MFA_ISSUER) };
}

/** שלב 2: קוד מהאפליקציה מאשר את ההפעלה; מוחזרים קודי שחזור (מוצגים פעם אחת בלבד). */
export async function confirmEnrollment(db: PrismaClient, userId: string, code: string, now = Date.now()): Promise<MfaResult<{ recoveryCodes: string[] }>> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { mfaSecretEnc: true, mfaEnabledAt: true } });
  if (!user?.mfaSecretEnc || user.mfaEnabledAt) return { ok: false, error: 'אין הפעלה ממתינה — התחילו מחדש' };
  const step = verifyTotp(decryptSecret(user.mfaSecretEnc), code, now);
  if (step === null) return { ok: false, error: 'הקוד שגוי — בדקו שהשעון בטלפון מעודכן ונסו שוב' };
  const codes = generateRecoveryCodes();
  return db.$transaction(async (tx) => {
    const r = await tx.user.updateMany({
      where: { id: userId, mfaEnabledAt: null, mfaSecretEnc: user.mfaSecretEnc },
      data: { mfaEnabledAt: new Date(now), mfaLastStep: step, sessionVersion: { increment: 1 } },
    });
    if (r.count !== 1) return { ok: false as const, error: 'ההפעלה השתנתה במקביל — התחילו מחדש' };
    await tx.userRecoveryCode.deleteMany({ where: { userId } });
    await tx.userRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) });
    return { ok: true as const, recoveryCodes: codes };
  });
}

/**
 * אימות בהתחברות או לפני פעולה רגישה: קוד TOTP (6 ספרות) או קוד שחזור.
 * מחזיר באיזו שיטה אומת (ליומן). כישלון — הודעה כללית.
 */
export async function verifyMfaCode(db: PrismaClient, userId: string, code: string, now = Date.now()): Promise<MfaResult<{ method: 'totp' | 'recovery'; recoveryLeft?: number }>> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { mfaSecretEnc: true, mfaEnabledAt: true, mfaLastStep: true } });
  if (!user?.mfaEnabledAt || !user.mfaSecretEnc) return { ok: false, error: 'האימות הדו-שלבי אינו פעיל' };
  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed.replace(/\s/g, ''))) {
    const step = verifyTotp(decryptSecret(user.mfaSecretEnc), trimmed, now, user.mfaLastStep);
    if (step === null) return { ok: false, error: 'קוד שגוי או שכבר נוצל' };
    // מותנה: בקשה מקבילה עם אותו קוד לא תעבור
    const r = await db.user.updateMany({
      where: { id: userId, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] },
      data: { mfaLastStep: step },
    });
    return r.count === 1 ? { ok: true, method: 'totp' } : { ok: false, error: 'קוד שגוי או שכבר נוצל' };
  }
  if (normalizeRecoveryCode(trimmed).length === 10) {
    const r = await db.userRecoveryCode.updateMany({
      where: { userId, codeHash: hashRecoveryCode(trimmed), usedAt: null },
      data: { usedAt: new Date(now) },
    });
    if (r.count !== 1) return { ok: false, error: 'קוד שגוי או שכבר נוצל' };
    const recoveryLeft = await db.userRecoveryCode.count({ where: { userId, usedAt: null } });
    return { ok: true, method: 'recovery', recoveryLeft };
  }
  return { ok: false, error: 'קוד שגוי או שכבר נוצל' };
}

async function clearMfa(db: PrismaClient, userId: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { mfaSecretEnc: null, mfaEnabledAt: null, mfaLastStep: null, sessionVersion: { increment: 1 } } }),
    db.userRecoveryCode.deleteMany({ where: { userId } }),
  ]);
}

/** ביטול בידי המשתמש — דורש קוד תקף (מהאפליקציה או קוד שחזור). */
export async function disableMfa(db: PrismaClient, userId: string, code: string, now = Date.now()): Promise<MfaResult> {
  const v = await verifyMfaCode(db, userId, code, now);
  if (!v.ok) return v;
  await clearMfa(db, userId);
  return { ok: true };
}

/** ביטול הפעלה שלא הושלמה (מפתח ממתין). */
export async function cancelEnrollment(db: PrismaClient, userId: string): Promise<void> {
  await db.user.updateMany({ where: { id: userId, mfaEnabledAt: null }, data: { mfaSecretEnc: null, mfaLastStep: null } });
}

/** קודי שחזור חדשים (הישנים מבוטלים) — דורש קוד תקף. */
export async function regenerateRecoveryCodes(db: PrismaClient, userId: string, code: string, now = Date.now()): Promise<MfaResult<{ recoveryCodes: string[] }>> {
  const v = await verifyMfaCode(db, userId, code, now);
  if (!v.ok) return v;
  const codes = generateRecoveryCodes();
  await db.$transaction([
    db.userRecoveryCode.deleteMany({ where: { userId } }),
    db.userRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return { ok: true, recoveryCodes: codes };
}

/** איפוס בידי סופר-אדמין (משתמש שאיבד את הטלפון) — מנתק את כל המכשירים של המשתמש. לא על עצמו. */
export async function resetMfaByAdmin(db: PrismaClient, targetUserId: string, adminUserId: string): Promise<MfaResult<{ email: string; nurseryId: string | null }>> {
  if (targetUserId === adminUserId) return { ok: false, error: 'אי אפשר לאפס לעצמכם — השתמשו בקוד שחזור' };
  const u = await db.user.findUnique({ where: { id: targetUserId }, select: { email: true, nurseryId: true, mfaSecretEnc: true } });
  if (!u) return { ok: false, error: 'המשתמש לא נמצא' };
  if (!u.mfaSecretEnc) return { ok: false, error: 'למשתמש אין אימות דו-שלבי' };
  await clearMfa(db, targetUserId);
  return { ok: true, email: u.email, nurseryId: u.nurseryId };
}
