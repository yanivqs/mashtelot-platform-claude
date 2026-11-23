/**
 * ספקים ויצרנים — חלקים טהורים (גם לדפדפן): תוויות, נרמול קוד יצרן וברקוד, slug.
 * הגישה ל-DB ב-lib/manufacturers-admin.ts.
 */
import type { SupplyCategory } from '@prisma/client';

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  SOIL: 'אדמה ומצעים',
  POTS: 'עציצים וכלים',
  PESTICIDES: 'הדברה',
  FERTILIZER: 'דשנים',
  TOOLS: 'כלי עבודה',
  GENERAL: 'כללי',
};

export const SUPPLY_CATEGORIES = Object.keys(SUPPLY_CATEGORY_LABELS) as SupplyCategory[];

export function isSupplyCategory(v: string): v is SupplyCategory {
  return v in SUPPLY_CATEGORY_LABELS;
}

/** slug ליצרן מהשם: אותיות (גם עבריות) וספרות, רווחים וסימנים → מקף. ריק → null. */
export function manufacturerSlug(name: string): string | null {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/["'׳״.,()]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || null;
}

/** קוד יצרן: רווחים מיותרים מוסרים; ריק → null. מחזיר undefined אם לא תקין. */
export function normalizeManufacturerCode(raw: string): string | null | undefined {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.length > 60) return undefined;
  return s;
}

/** ברקוד: ספרות/אותיות לטיניות ומקפים, 4–32 תווים (רווחים מוסרים); ריק → null; לא תקין → undefined. */
export function normalizeBarcode(raw: string): string | null | undefined {
  const s = raw.replace(/\s+/g, '');
  if (!s) return null;
  return /^[0-9A-Za-z-]{4,32}$/.test(s) ? s : undefined;
}
