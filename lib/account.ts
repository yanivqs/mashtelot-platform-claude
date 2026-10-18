import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';

/**
 * החלפת סיסמה לחשבון ניהול (C-P0-03). מופרד מה-Server Action כדי שיהיה בר-בדיקה
 * מול בסיס נתונים. ה-Action מזהה את המשתמש מה-session — לעולם לא userId מהלקוח.
 */

export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

/** סיסמאות שנחשפו בקוד בעבר או נפוצות במיוחד — נדחות תמיד. */
const BLOCKED_PASSWORDS = new Set([
  'admin1234',
  'owner1234',
  'password',
  'password123',
  '123456789012',
  'qwertyuiop12',
]);

/** בדיקת חוזק בסיסית לסיסמה חדשה. מחזיר הודעת שגיאה או null. */
export function validateNewPassword(next: string, current?: string): string | null {
  if (next.length < MIN_PASSWORD_LENGTH) return `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`;
  if (next.length > MAX_PASSWORD_LENGTH) return 'הסיסמה ארוכה מדי';
  if (BLOCKED_PASSWORDS.has(next.toLowerCase())) return 'סיסמה זו אינה מותרת';
  if (/^(.)\1+$/.test(next)) return 'הסיסמה חלשה מדי';
  if (current !== undefined && next === current) return 'הסיסמה החדשה זהה לנוכחית';
  return null;
}

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

/**
 * S-21: אימייל של משתמש קיים אינו משויך מחדש למשתלה חדשה — אחרת יצירת משתלה הייתה
 * מעבירה בעלים של משתלה אחרת (או את הסופר-אדמין), משנה את תפקידו ודורסת את סיסמתו.
 */
export async function isEmailTaken(db: PrismaClient, email: string): Promise<boolean> {
  return (await db.user.count({ where: { email: email.trim().toLowerCase() } })) > 0;
}

export async function changePassword(
  db: PrismaClient,
  userId: string,
  input: { current: string; next: string; confirm: string },
): Promise<ChangePasswordResult> {
  if (input.next !== input.confirm) return { ok: false, error: 'אימות הסיסמה אינו תואם' };
  const weak = validateNewPassword(input.next, input.current);
  if (weak) return { ok: false, error: weak };

  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user?.passwordHash || !(await bcrypt.compare(input.current, user.passwordHash))) {
    return { ok: false, error: 'הסיסמה הנוכחית שגויה' };
  }

  const passwordHash = await bcrypt.hash(input.next, 12);
  // עדכון מותנה בגיבוב הישן — שתי החלפות מקבילות לא ידרסו זו את זו בשקט.
  // העלאת גרסת ה-session מנתקת את כל המכשירים האחרים (SEC-02).
  const res = await db.user.updateMany({
    where: { id: userId, passwordHash: user.passwordHash },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
  if (res.count !== 1) return { ok: false, error: 'הסיסמה שונתה במקביל — נסו שוב' };
  return { ok: true };
}
