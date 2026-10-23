/**
 * מחזור חיים של משתלה (§2.03). טהור — בטוח לייבוא בכל מקום.
 * טיוטה: בהקמה — בעלים וצוות עובדים, החנות לא ציבורית. פעילה: רגיל.
 * מושעית: החנות "סגורה זמנית", הבעלים והצוות חסומים. ארכיון: הכל סגור, הנתונים נשמרים.
 */
import type { NurseryStatus } from '@prisma/client';

export const NURSERY_STATUSES: NurseryStatus[] = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];

export const NURSERY_STATUS_LABELS: Record<NurseryStatus, string> = {
  DRAFT: 'טיוטה (בהקמה)',
  ACTIVE: 'פעילה',
  SUSPENDED: 'מושעית',
  ARCHIVED: 'ארכיון',
};

export const NURSERY_STATUS_CLS: Record<NurseryStatus, string> = {
  DRAFT: 'bg-sky-50 text-sky-700',
  ACTIVE: 'bg-green-100 text-green-800',
  SUSPENDED: 'bg-amber-50 text-amber-800',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

/** בעלים וצוות יכולים לעבוד בפורטל (כולל בזמן ההקמה). */
export function canOperate(status: NurseryStatus): boolean {
  return status === 'DRAFT' || status === 'ACTIVE';
}

/** החנות פתוחה ללקוחות. */
export function isPublic(status: NurseryStatus): boolean {
  return status === 'ACTIVE';
}

export function isNurseryStatus(v: unknown): v is NurseryStatus {
  return typeof v === 'string' && (NURSERY_STATUSES as string[]).includes(v);
}
