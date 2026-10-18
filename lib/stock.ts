/** יחידות זמינות למכירה: on_hand פחות השמור להזמנות פתוחות (C-P1-02). טהור. */
export function availableQuantity(p: { stockQuantity: number; reservedQuantity?: number | null }): number {
  return Math.max(0, p.stockQuantity - (p.reservedQuantity ?? 0));
}
