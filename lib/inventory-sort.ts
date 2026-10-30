/** מיון "המלאי שלי" לפי עמודה (טהור — בדיק ביחידה). */
export type InventorySortKey = 'price' | 'stock' | 'status' | 'seo';
export type SortDir = 'asc' | 'desc';

export const INVENTORY_SORT_KEYS: InventorySortKey[] = ['price', 'stock', 'status', 'seo'];

export interface SortableRow {
  title: string;
  price: string;
  stockQuantity: number;
  isActive: boolean;
  seo: { score: number };
}

export function parseInventorySort(sort?: string, dir?: string): { key: InventorySortKey | null; dir: SortDir } {
  const key = INVENTORY_SORT_KEYS.includes(sort as InventorySortKey) ? (sort as InventorySortKey) : null;
  return { key, dir: dir === 'desc' ? 'desc' : 'asc' };
}

const value = (r: SortableRow, key: InventorySortKey): number =>
  key === 'price' ? Number(r.price) : key === 'stock' ? r.stockQuantity : key === 'status' ? (r.isActive ? 1 : 0) : r.seo.score;

/** מיון יציב; שוויון — לפי שם. בלי מפתח — הסדר המקורי. */
export function sortInventory<T extends SortableRow>(rows: T[], key: InventorySortKey | null, dir: SortDir): T[] {
  if (!key) return rows;
  const sign = dir === 'desc' ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => sign * (value(a.r, key) - value(b.r, key)) || a.r.title.localeCompare(b.r.title, 'he') || a.i - b.i)
    .map(({ r }) => r);
}
