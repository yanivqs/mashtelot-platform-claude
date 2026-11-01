import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number (or Prisma Decimal) as ILS currency. */
export function formatPrice(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num);
}

/**
 * כתובת המוצר בחנות: ה-slug שנשמר למוצר, ואם אין — "<שם>-<8 תווים ראשונים של המזהה>".
 * (פורמט ישן: "<שם>--<מזהה מלא>" — עדיין נפתח ומופנה לכתובת הנוכחית.)
 */
export function productSlug(id: string, title: string, slug?: string | null): string {
  if (slug) return slug;
  const clean = title
    .trim()
    .replace(/['"״׳]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return clean ? `${clean}-${id.slice(0, 8)}` : id.slice(0, 8);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** זיהוי המוצר מהכתובת: מזהה מלא (פורמט ישן / מזהה בלבד) או 8 תווי מזהה בסוף הכתובת. */
export function parseProductParam(param: string): { id: string } | { idPrefix: string } | null {
  const idx = param.lastIndexOf('--');
  const tail = idx === -1 ? param : param.slice(idx + 2);
  if (UUID_RE.test(tail)) return { id: tail.toLowerCase() };
  const m = /(?:^|-)([0-9a-f]{8})$/i.exec(param);
  return m ? { idPrefix: m[1]!.toLowerCase() } : null;
}

/** נירמול slug שהוזן ידנית: אותיות לועזיות קטנות, ספרות ומקפים, עד 60 תווים. ריק = null. */
export function normalizeProductSlug(input: string): string | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || null;
}

/** slug ששמור לא יכול להיראות כמו מזהה (אחרת יתנגש בזיהוי לפי מזהה). */
export function isReservedProductSlug(slug: string): boolean {
  return UUID_RE.test(slug) || /^[0-9a-f]{8}$/.test(slug);
}
