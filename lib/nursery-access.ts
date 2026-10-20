/**
 * החלטת הגישה להקשר משתלה בפורטל הניהול (C-P1-01). טהור — ללא Next/DB.
 *
 * מדיניות (אושרה ע"י הבעלים, 2026-10-18):
 * - הקשר המשתלה נקבע אך ורק מהמשתמש המחובר — לעולם לא "המשתלה הראשונה" ולא מזהה מהלקוח.
 * - סופר-אדמין מנהל את הפלטפורמה בלבד: אין לו גישה לנתונים התפעוליים של חנות
 *   (מוצרים, הזמנות, לקוחות, הגדרות). אפיון §4.06, §15.02, §15.05.
 * - משתלה מושעית: הבעלים חסום לחלוטין, כולל sessions קיימים. אפיון §2.03.
 * - מודול שאינו משויך חוסם גם את ה-Server Action, לא רק את הדף. אפיון §16 קבלה.
 *
 * צוות משתלה (R06-01/02, החלטת בעלים 2026-10-20) — שני תפקידים קבועים, עד 5 לכל משתלה:
 * - עובד (NURSERY_STAFF): כל ניהול המשתלה, חוץ מתחום "owner" (צוות) ו"החשבון שלי".
 * - כותב תוכן (NURSERY_WRITER): רק תחום "content" (עמודים ובלוג).
 * - משתמש מושבת — חסום לחלוטין, כולל sessions קיימים.
 */
import type { Role } from '@prisma/client';
import type { ModuleKey } from '@/lib/modules';

export type AccessDenial =
  | 'NOT_AUTHENTICATED'
  | 'PLATFORM_ROLE'
  | 'NO_NURSERY'
  | 'NURSERY_SUSPENDED'
  | 'MODULE_DISABLED'
  | 'ROLE_FORBIDDEN';

export const DENIAL_MESSAGES: Record<AccessDenial, string> = {
  NOT_AUTHENTICATED: 'נדרשת התחברות',
  PLATFORM_ROLE: 'מסך זה מיועד לבעל המשתלה. ניהול משתלות מתבצע במסך "משתלות".',
  NO_NURSERY: 'לחשבון זה אין משתלה משויכת',
  NURSERY_SUSPENDED: 'המשתלה מושעית. לפרטים פנו לצוות הפלטפורמה.',
  MODULE_DISABLED: 'היכולת אינה פעילה במשתלה זו',
  ROLE_FORBIDDEN: 'אין לך הרשאה למסך זה. לשינוי הרשאות פנו לבעל המשתלה.',
};

/** תפקידי משתלה (בעלים + צוות). */
export const NURSERY_ROLES: readonly Role[] = ['NURSERY_OWNER', 'NURSERY_STAFF', 'NURSERY_WRITER'];
export const STAFF_ROLES: readonly Role[] = ['NURSERY_STAFF', 'NURSERY_WRITER'];

export const ROLE_LABELS: Partial<Record<Role, string>> = {
  NURSERY_OWNER: 'בעל המשתלה',
  NURSERY_STAFF: 'עובד',
  NURSERY_WRITER: 'כותב תוכן',
};

/** תחום המסך: general (ברירת מחדל) · content (עמודים/בלוג) · owner (בעל המשתלה בלבד). */
export type NurseryArea = 'general' | 'content' | 'owner';

export function roleAllowsArea(role: Role, area: NurseryArea): boolean {
  if (role === 'NURSERY_OWNER') return true;
  if (role === 'NURSERY_STAFF') return area !== 'owner';
  if (role === 'NURSERY_WRITER') return area === 'content';
  return false;
}

export interface AccessSubject {
  role: Role;
  nurseryId: string | null;
  /** null = אין משתלה משויכת */
  nurseryActive: boolean | null;
  /** משתמש צוות שהושבת בידי בעל המשתלה */
  disabled?: boolean;
}

export interface ModuleRequirement {
  /** כל המודולים חייבים להיות פעילים */
  all?: ModuleKey[];
  /** לפחות אחד מהמודולים פעיל */
  any?: ModuleKey[];
  /** תחום המסך לפי תפקיד (ברירת מחדל general) */
  area?: NurseryArea;
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
  if (!NURSERY_ROLES.includes(subject.role)) return { ok: false, reason: 'PLATFORM_ROLE' };
  if (subject.disabled) return { ok: false, reason: 'NOT_AUTHENTICATED' };
  if (!subject.nurseryId || subject.nurseryActive === null) return { ok: false, reason: 'NO_NURSERY' };
  if (!subject.nurseryActive) return { ok: false, reason: 'NURSERY_SUSPENDED' };
  if (!roleAllowsArea(subject.role, req.area ?? 'general')) return { ok: false, reason: 'ROLE_FORBIDDEN' };
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
  if (subject.disabled) return false;
  return !(NURSERY_ROLES.includes(subject.role) && subject.nurseryActive === false);
}

/** האם תפקיד רשאי להתחבר לפורטל הניהול בכלל. */
export function canUseAdminPortal(subject: AccessSubject): { ok: true } | { ok: false; error: string } {
  if (subject.role !== 'SUPER_ADMIN' && !NURSERY_ROLES.includes(subject.role)) {
    return { ok: false, error: 'אין לך הרשאת גישה לפורטל הניהול' };
  }
  if (subject.disabled) return { ok: false, error: 'החשבון הושבת. לפרטים פנו לבעל המשתלה.' };
  if (!isSessionAllowed(subject)) return { ok: false, error: DENIAL_MESSAGES.NURSERY_SUSPENDED };
  return { ok: true };
}
