/**
 * רשת הקוביות של בלוק הקטגוריות במחשב. שורה = 2 קוביות בגובה; ברוחב 2 קוביות לכל קטגוריה רגילה.
 * 4 בשורה = 8×2 (16 קוביות), 3 בשורה = 6×2 (12 קוביות). רגילה = ריבוע 2×2, רחבה = 4×2.
 * טהור — משמש את החנות, העורך והבדיקות.
 */
export type CategoryTileSize = 'normal' | 'wide';
export type DesktopPerRow = 3 | 4;

export const DESKTOP_PER_ROW: readonly DesktopPerRow[] = [4, 3];
export const MOBILE_PER_ROW = [1, 2, 3] as const;
export type MobilePerRow = (typeof MOBILE_PER_ROW)[number];
export type MobileRatio = 'square' | 'wide';

/** מספר העמודות (קוביות ברוחב) בשורה. */
export function gridColumns(perRow: DesktopPerRow): number {
  return perRow * 2;
}

/** כמה עמודות תופס אריח. */
export function tileSpan(size: CategoryTileSize): number {
  return size === 'wide' ? 4 : 2;
}

/** כמה קוביות (רוחב × 2 בגובה) תופס אריח. */
export function tileCubes(size: CategoryTileSize): number {
  return tileSpan(size) * 2;
}

/** מידה מומלצת לתמונה במחשב, לפי גודל האריח. */
export function recommendedSize(size: CategoryTileSize): string {
  return size === 'wide' ? '1600×800 פיקסלים (יחס 2:1)' : '800×800 פיקסלים (ריבוע)';
}

export interface GridRow<T> {
  items: Array<T & { span: number }>;
  /** עמודות ריקות בסוף השורה */
  emptyColumns: number;
}

/**
 * חלוקה לשורות לפי הסדר, כמו ש-CSS Grid מסדר (בלי מילוי חורים): אריח שלא נכנס עובר לשורה הבאה.
 */
export function layoutRows<T extends { size: CategoryTileSize }>(items: readonly T[], perRow: DesktopPerRow): GridRow<T>[] {
  const cols = gridColumns(perRow);
  const rows: GridRow<T>[] = [];
  let current: GridRow<T> = { items: [], emptyColumns: cols };
  for (const item of items) {
    const span = Math.min(tileSpan(item.size), cols);
    if (span > current.emptyColumns && current.items.length) {
      rows.push(current);
      current = { items: [], emptyColumns: cols };
    }
    current.items.push({ ...item, span });
    current.emptyColumns -= span;
  }
  if (current.items.length) rows.push(current);
  return rows;
}
