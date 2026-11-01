/** יחידות זמינות למכירה: on_hand פחות השמור להזמנות פתוחות (C-P1-02). טהור. */
export function availableQuantity(p: { stockQuantity: number; reservedQuantity?: number | null }): number {
  return Math.max(0, p.stockQuantity - (p.reservedQuantity ?? 0));
}

/** כמות "זמינה" למוצר שמוגדר תמיד במלאי — תקרה מעשית לבחירת כמות בעגלה. */
export const UNLIMITED_STOCK = 9999;

/** זמין למכירה בפועל: מוצר "תמיד במלאי" — ללא תלות בכמות; אחרת on_hand פחות שמור. */
export function sellableQuantity(
  v: { stockQuantity: number; reservedQuantity?: number | null },
  product: { alwaysInStock?: boolean | null },
): number {
  return product.alwaysInStock ? UNLIMITED_STOCK : availableQuantity(v);
}
