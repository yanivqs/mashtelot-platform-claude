/**
 * החלטת הגישה להקשר משתלה בפורטל הניהול (C-P1-01). טהור — ללא Next/DB.
 *
 * מדיניות (אושרה ע"י הבעלים, 2026-10-18):
 * - הקשר המשתלה נקבע אך ורק מהמשתמש המחובר — לעולם לא "המשתלה הראשונה" ולא מזהה מהלקוח.
 * - סופר-אדמין מנהל את הפלטפורמה בלבד: אין לו גישה לנתונים התפעוליים של חנות
 *   (מוצרים, הזמנות, לקוחות, הגדרות). אפיון §4.06, §15.02, §15.05.
 * - משתלה מושעית: הבעלים חסום לחלוטין, כולל sessions קיימים. אפיון §2.03.
 * - מודול שאינו משויך חוסם גם את ה-Server Action, לא רק את הדף. אפיון §16 קבלה.
 */
import type { Role } from '@prisma/client';
import type { ModuleKey } from '@/lib/modules';

export type AccessDenial =
  | 'NOT_AUTHENTICATED'
  | 'PLATFORM_ROLE'
  | 'NO_NURSERY'
  | 'NURSERY_SUSPENDED'
  | 'MODULE_DISABLED';

export const DENIAL_MESSAGES: Record<AccessDenial, string> = {
  NOT_AUTHENTICATED: 'נדרשת התחברות',
  PLATFORM_ROLE: 'מסך זה מיועד לבעל המשתלה. ניהול משתלות מתבצע במסך "משתלות".',
  NO_NURSERY: 'לחשבון זה אין משתלה משויכת',
  NURSERY_SUSPENDED: 'המשתלה מושעית. לפרטים פנו לצוות הפלטפורמה.',
  MODULE_DISABLED: 'היכולת אינה פעילה במשתלה זו',
};

export interface AccessSubject {
  role: Role;
  nurseryId: string | null;
  /** null = אין משתלה משויכת */
  nurseryActive: boolean | null;
}

export interface ModuleRequirement {
  /** כל המודולים חייבים להיות פעילים */
  all?: ModuleKey[];
  /** לפחות אחד מהמודולים פעיל */
  any?: ModuleKey[];
}

export type AccessDecision =
  | { ok: true; nurseryId: string }
  | { ok: false; reason: AccessDenial };

export function decideNurseryAccess(
  subject: AccessSubject | null,
  enabledModules: ReadonlySet<ModuleKey>,
  req: ModuleRequirement = {},
): AccessDecision {
  if (!subject) return { ok: false, reason: 'NOT_AUTHENTICATED' };
  if (subject.role !== 'NURSERY_OWNER') return { ok: false, reason: 'PLATFORM_ROLE' };
  if (!subject.nurseryId || subject.nurseryActive === null) return { ok: false, reason: 'NO_NURSERY' };
  if (!subject.nurseryActive) return { ok: false, reason: 'NURSERY_SUSPENDED' };
  if (req.all?.some((m) => !enabledModules.has(m))) return { ok: false, reason: 'MODULE_DISABLED' };
  if (req.any?.length && !req.any.some((m) => enabledModules.has(m))) {
    return { ok: false, reason: 'MODULE_DISABLED' };
  }
  return { ok: true, nurseryId: subject.nurseryId };
}

/**
 * האם session תקף לפורטל: בעלים של משתלה מושעית מנותק מיד (גם session קיים),
 * לא רק בהתחברות הבאה. משתמשים אחרים — לפי התפקיד בלבד.
 */
export function isSessionAllowed(subject: AccessSubject): boolean {
  return !(subject.role === 'NURSERY_OWNER' && subject.nurseryActive === false);
}

/** האם תפקיד רשאי להתחבר לפורטל הניהול בכלל. */
export function canUseAdminPortal(subject: AccessSubject): { ok: true } | { ok: false; error: string } {
  if (subject.role !== 'SUPER_ADMIN' && subject.role !== 'NURSERY_OWNER') {
    return { ok: false, error: 'אין לך הרשאת גישה לפורטל הניהול' };
  }
  if (!isSessionAllowed(subject)) return { ok: false, error: DENIAL_MESSAGES.NURSERY_SUSPENDED };
  return { ok: true };
}
