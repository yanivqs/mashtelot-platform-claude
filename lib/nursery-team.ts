/**
 * צוות משתלה (R06-01/02) — בעל המשתלה מוסיף, משנה תפקיד, מאפס סיסמה ומשבית עובדים.
 * מקבל את ה-DB כפרמטר (בר-בדיקה). כל פעולה מוגבלת למשתלה של בעל המשתלה ולמשתמשי צוות בלבד
 * (לעולם לא בעל המשתלה עצמו או משתמש של משתלה אחרת).
 * החלטת בעלים: הסיסמה נקבעת בידי בעל המשתלה; לעובד אין "החשבון שלי".
 */
import type { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';
import { STAFF_ROLES } from '@/lib/nursery-access';

export const MAX_STAFF = 5;

export type TeamResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkPassword(p: string): string | null {
  return p.length < MIN_PASSWORD_LENGTH ? `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים` : null;
}

function isStaffRole(role: string): role is 'NURSERY_STAFF' | 'NURSERY_WRITER' {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export async function listTeam(db: PrismaClient, nurseryId: string) {
  return db.user.findMany({
    where: { nurseryId, role: { in: [...STAFF_ROLES] } },
    select: { id: true, email: true, fullName: true, role: true, disabledAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** עובד חדש. מגבלת 5 עובדים פעילים נבדקת בתוך טרנזקציה עם נעילת שורת המשתלה (אין עקיפה במקביל). */
export async function addMember(
  db: PrismaClient,
  nurseryId: string,
  input: { email: string; fullName?: string | null; role: string; password: string },
): Promise<TeamResult & { userId?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'כתובת אימייל לא תקינה' };
  if (!isStaffRole(input.role)) return { ok: false, error: 'תפקיד לא תקין' };
  const pwErr = checkPassword(input.password);
  if (pwErr) return { ok: false, error: pwErr };
  const passwordHash = await bcrypt.hash(input.password, 10);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM nurseries WHERE id = ${nurseryId} FOR UPDATE`;
    const active = await tx.user.count({ where: { nurseryId, role: { in: [...STAFF_ROLES] }, disabledAt: null } });
    if (active >= MAX_STAFF) return { ok: false as const, error: `אפשר עד ${MAX_STAFF} עובדים פעילים. השביתו עובד כדי להוסיף חדש.` };
    if (await tx.user.findUnique({ where: { email }, select: { id: true } })) {
      return { ok: false as const, error: 'כתובת האימייל כבר רשומה במערכת' };
    }
    const u = await tx.user.create({
      data: { email, fullName: input.fullName?.trim() || null, role: input.role as Role, nurseryId, passwordHash },
    });
    return { ok: true as const, userId: u.id };
  });
}

async function member(db: PrismaClient, nurseryId: string, userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, nurseryId: true, disabledAt: true } });
  return u && u.nurseryId === nurseryId && isStaffRole(u.role) ? u : null;
}

export async function setMemberRole(db: PrismaClient, nurseryId: string, userId: string, role: string): Promise<TeamResult & { email?: string }> {
  if (!isStaffRole(role)) return { ok: false, error: 'תפקיד לא תקין' };
  const u = await member(db, nurseryId, userId);
  if (!u) return { ok: false, error: 'העובד לא נמצא' };
  // שינוי תפקיד מנתק את העובד — ההרשאות החדשות חלות מיד
  await db.user.update({ where: { id: u.id }, data: { role: role as Role, sessionVersion: { increment: 1 } } });
  return { ok: true, email: u.email };
}

export async function resetMemberPassword(db: PrismaClient, nurseryId: string, userId: string, password: string): Promise<TeamResult & { email?: string }> {
  const pwErr = checkPassword(password);
  if (pwErr) return { ok: false, error: pwErr };
  const u = await member(db, nurseryId, userId);
  if (!u) return { ok: false, error: 'העובד לא נמצא' };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(password, 10), sessionVersion: { increment: 1 } } });
  return { ok: true, email: u.email };
}

/** השבתה (מנותק מיד מכל המכשירים) או החזרה לפעילות (בכפוף למגבלת 5 הפעילים). */
export async function setMemberDisabled(db: PrismaClient, nurseryId: string, userId: string, disabled: boolean): Promise<TeamResult & { email?: string }> {
  const u = await member(db, nurseryId, userId);
  if (!u) return { ok: false, error: 'העובד לא נמצא' };
  return db.$transaction(async (tx) => {
    if (!disabled) {
      await tx.$queryRaw`SELECT id FROM nurseries WHERE id = ${nurseryId} FOR UPDATE`;
      const active = await tx.user.count({ where: { nurseryId, role: { in: [...STAFF_ROLES] }, disabledAt: null, id: { not: u.id } } });
      if (active >= MAX_STAFF) return { ok: false as const, error: `אפשר עד ${MAX_STAFF} עובדים פעילים` };
    }
    await tx.user.update({
      where: { id: u.id },
      data: disabled ? { disabledAt: new Date(), sessionVersion: { increment: 1 } } : { disabledAt: null },
    });
    return { ok: true as const, email: u.email };
  });
}
