/**
 * מועדון נקודות והנחת קבוצה (R06-06/07) — חישובים טהורים + פעולות יומן (Ledger) בתוך טרנזקציה.
 *
 * סדר המחיר בהזמנה: מוצרים → הנחת קבוצה (%) → קופון (%) → מימוש נקודות (עד X% ממה שנשאר) → משלוח.
 * צבירה: כשההזמנה "נמסרה" — נקודות לפי מה ששולם על מוצרים (אחרי כל ההנחות, בלי משלוח).
 * ביטול: מבטל צבירה ומחזיר נקודות שמומשו — פעם אחת לכל סוג (ייחודי להזמנה+סוג).
 * pointValue = 0 → הצבירה והמימוש כבויים (בעל המשתלה עוד לא הגדיר שווי לנקודה).
 */
import type { LoyaltyKind, Prisma } from '@prisma/client';

export interface LoyaltyConfig {
  pointsPerShekel: number;
  pointValue: number;
  maxRedeemPct: number;
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

export function loyaltyActive(c: LoyaltyConfig | null | undefined): c is LoyaltyConfig {
  return Boolean(c && c.pointValue > 0);
}

export function validateLoyaltyConfig(raw: { pointsPerShekel: unknown; pointValue: unknown; maxRedeemPct: unknown }): { ok: true; value: LoyaltyConfig } | { ok: false; error: string } {
  const pps = Number(raw.pointsPerShekel);
  const pv = Number(raw.pointValue);
  const pct = Number(raw.maxRedeemPct);
  if (!Number.isFinite(pps) || pps < 0 || pps > 100) return { ok: false, error: 'נקודות לכל ₪ — בין 0 ל-100' };
  if (!Number.isFinite(pv) || pv < 0 || pv > 100) return { ok: false, error: 'שווי נקודה — בין 0 ל-100 ₪' };
  if (!Number.isInteger(pct) || pct < 0 || pct > 100) return { ok: false, error: 'תקרת מימוש — אחוז שלם בין 0 ל-100' };
  return { ok: true, value: { pointsPerShekel: round2(pps), pointValue: Math.round(pv * 10000) / 10000, maxRedeemPct: pct } };
}

/** נקודות לצבירה על סכום ששולם על מוצרים. */
export function pointsToEarn(paidForItems: number, c: LoyaltyConfig): number {
  if (!loyaltyActive(c) || paidForItems <= 0) return 0;
  return Math.floor(paidForItems * c.pointsPerShekel + 1e-9);
}

/** כמה נקודות אפשר לממש בהזמנה: לפי היתרה ותקרת האחוז מהסכום אחרי הנחות. */
export function maxRedeemablePoints(balance: number, amountAfterDiscounts: number, c: LoyaltyConfig): number {
  if (!loyaltyActive(c) || balance <= 0 || amountAfterDiscounts <= 0) return 0;
  const capShekels = (amountAfterDiscounts * c.maxRedeemPct) / 100;
  return Math.max(0, Math.min(balance, Math.floor(capShekels / c.pointValue + 1e-9)));
}

export function pointsDiscount(points: number, c: LoyaltyConfig): number {
  return round2(points * c.pointValue);
}

/** הנחת קבוצה (0–50%) על סכום המוצרים. */
export function groupDiscountAmount(subtotal: number, pct: number): number {
  if (!(pct > 0)) return 0;
  return round2((subtotal * Math.min(pct, 50)) / 100);
}

// ---------- Ledger (בתוך טרנזקציה) ----------

type Tx = Prisma.TransactionClient;

export async function balanceOf(tx: Tx | { loyaltyEntry: Tx['loyaltyEntry'] }, customerId: string): Promise<number> {
  const r = await tx.loyaltyEntry.aggregate({ where: { customerId }, _sum: { points: true } });
  return r._sum.points ?? 0;
}

/** נועל את הלקוח עד סוף הטרנזקציה — מימושים מקבילים לא יעברו את היתרה. */
export async function lockCustomer(tx: Tx, customerId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customerId} FOR UPDATE`;
}

/** שורה אחת לכל (הזמנה, סוג) — ניסיון כפול מתעלם (מוחזר false). */
export async function addEntry(
  tx: Tx,
  e: { nurseryId: string; customerId: string; orderId?: string | null; kind: LoyaltyKind; points: number; note?: string | null; actorEmail?: string | null },
): Promise<boolean> {
  if (e.points === 0) return false;
  if (e.orderId && (await tx.loyaltyEntry.count({ where: { orderId: e.orderId, kind: e.kind } }))) return false;
  await tx.loyaltyEntry.create({
    data: { nurseryId: e.nurseryId, customerId: e.customerId, orderId: e.orderId ?? null, kind: e.kind, points: e.points, note: e.note ?? null, actorEmail: e.actorEmail ?? null },
  });
  return true;
}

/** הגדרות המועדון של המשתלה — רק כשמודול המועדון פעיל ושווי הנקודה הוגדר. */
export async function activeLoyaltyConfig(tx: Tx, nurseryId: string): Promise<LoyaltyConfig | null> {
  const mod = await tx.nurseryModule.findFirst({ where: { nurseryId, moduleKey: 'loyalty', isEnabled: true }, select: { id: true } });
  if (!mod) return null;
  const s = await tx.loyaltySettings.findUnique({ where: { nurseryId } });
  if (!s) return null;
  const c = { pointsPerShekel: Number(s.pointsPerShekel), pointValue: Number(s.pointValue), maxRedeemPct: s.maxRedeemPct };
  return loyaltyActive(c) ? c : null;
}

/** "נמסרה" → צבירה; "בוטלה" → ביטול צבירה והחזרת מימוש. נקרא בתוך הטרנזקציה של מעבר הסטטוס. */
export async function loyaltyOnTransition(
  tx: Tx,
  order: { id: string; nurseryId: string; customerId: string | null; totalAmount: Prisma.Decimal | number; shippingCost: Prisma.Decimal | number | null },
  to: string,
  actorEmail?: string | null,
): Promise<void> {
  if (!order.customerId) return;
  if (to === 'DELIVERED') {
    const c = await activeLoyaltyConfig(tx, order.nurseryId);
    if (!c) return;
    const paidForItems = Number(order.totalAmount) - Number(order.shippingCost ?? 0);
    await addEntry(tx, { nurseryId: order.nurseryId, customerId: order.customerId, orderId: order.id, kind: 'EARN', points: pointsToEarn(paidForItems, c), actorEmail });
  }
  if (to === 'CANCELLED') {
    const entries = await tx.loyaltyEntry.findMany({ where: { orderId: order.id } });
    const earn = entries.find((e) => e.kind === 'EARN');
    const redeem = entries.find((e) => e.kind === 'REDEEM');
    // ביטול צבירה עלול להוריד את היתרה מתחת לאפס אם הנקודות כבר מומשו — מותר (חוב שמתקזז בצבירה הבאה)
    if (earn) await addEntry(tx, { nurseryId: order.nurseryId, customerId: order.customerId, orderId: order.id, kind: 'REVERSE_EARN', points: -earn.points, actorEmail });
    if (redeem) await addEntry(tx, { nurseryId: order.nurseryId, customerId: order.customerId, orderId: order.id, kind: 'REFUND_REDEEM', points: -redeem.points, actorEmail });
  }
}
