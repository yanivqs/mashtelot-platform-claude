/**
 * שירות הזמנות ומלאי (C-P1-02, אפיון §8, §9, §12.01, R05-07, R05-08).
 *
 * מקבל את ה-Prisma client כפרמטר כדי שיהיה בר-בדיקה מול בסיס נתונים, ללא תלות ב-Next.
 * ה-Server Actions אחראים לזיהוי (משתלה מהדומיין / מהמשתמש), rate limit ומיילים.
 *
 * מודל המלאי: stockQuantity = on_hand, reservedQuantity = שמור; זמין = on_hand − שמור.
 * כל שינוי — עדכון מותנה אטומי (אין overselling במקביל) + רשומת StockMovement.
 */
import { Prisma, type OrderStatus, type PaymentStatus, type PaymentMethod, type PrismaClient } from '@prisma/client';
import {
  CheckoutError,
  applyDiscount,
  assertCouponMinOrder,
  assertCouponValid,
  buildLineItems,
  calcSubtotal,
  resolveShippingCost,
  type DeliveryChoice,
  type ShippingZoneForCheckout,
} from '@/lib/checkout-calc';
import {
  allowedNextPaymentStatuses,
  canTransition,
  normalizeStatus,
  reservationExpiry,
  stockEffectFor,
  ORDER_STATUS_LABELS,
} from '@/lib/order-state';
import { resolveProductContent } from '@/lib/seo';

type Tx = Prisma.TransactionClient;
type Line = { nurseryProductId: string; quantity: number; productTitle?: string };

// ---------- פעולות מלאי (בתוך טרנזקציה) ----------

async function movement(
  tx: Tx,
  data: {
    nurseryId: string;
    nurseryProductId: string;
    orderId?: string | null;
    reason: Prisma.StockMovementCreateManyInput['reason'];
    onHandDelta?: number;
    reservedDelta?: number;
    actorEmail?: string | null;
  },
) {
  await tx.stockMovement.create({ data: { onHandDelta: 0, reservedDelta: 0, ...data } });
}

/** שמירת מלאי לשורות ההזמנה. נכשל (וכל הטרנזקציה מתבטלת) אם אין מספיק זמין. */
export async function reserveLines(tx: Tx, nurseryId: string, orderId: string | null, lines: Line[], actorEmail?: string | null) {
  for (const l of lines) {
    const n = await tx.$executeRaw`
      UPDATE "nursery_products"
      SET "reserved_quantity" = "reserved_quantity" + ${l.quantity}
      WHERE "id" = ${l.nurseryProductId} AND "nursery_id" = ${nurseryId}
        AND "stock_quantity" - "reserved_quantity" >= ${l.quantity}`;
    if (n !== 1) {
      throw new CheckoutError(`אין מספיק מלאי זמין עבור "${l.productTitle ?? 'אחד המוצרים'}"`);
    }
    await movement(tx, { nurseryId, nurseryProductId: l.nurseryProductId, orderId, reason: 'RESERVE', reservedDelta: l.quantity, actorEmail });
  }
}

async function releaseLines(tx: Tx, nurseryId: string, orderId: string, lines: Line[], reason: 'RELEASE_EXPIRED' | 'RELEASE_CANCELLED', actorEmail?: string | null) {
  for (const l of lines) {
    const n = await tx.$executeRaw`
      UPDATE "nursery_products"
      SET "reserved_quantity" = "reserved_quantity" - ${l.quantity}
      WHERE "id" = ${l.nurseryProductId} AND "nursery_id" = ${nurseryId}
        AND "reserved_quantity" >= ${l.quantity}`;
    if (n !== 1) throw new Error(`reserved_quantity inconsistency for product ${l.nurseryProductId}`);
    await movement(tx, { nurseryId, nurseryProductId: l.nurseryProductId, orderId, reason, reservedDelta: -l.quantity, actorEmail });
  }
}

async function commitLines(tx: Tx, nurseryId: string, orderId: string, lines: Line[], actorEmail?: string | null) {
  for (const l of lines) {
    const n = await tx.$executeRaw`
      UPDATE "nursery_products"
      SET "stock_quantity" = "stock_quantity" - ${l.quantity},
          "reserved_quantity" = "reserved_quantity" - ${l.quantity}
      WHERE "id" = ${l.nurseryProductId} AND "nursery_id" = ${nurseryId}
        AND "reserved_quantity" >= ${l.quantity} AND "stock_quantity" >= ${l.quantity}`;
    if (n !== 1) throw new Error(`stock inconsistency committing product ${l.nurseryProductId}`);
    await movement(tx, { nurseryId, nurseryProductId: l.nurseryProductId, orderId, reason: 'COMMIT', onHandDelta: -l.quantity, reservedDelta: -l.quantity, actorEmail });
  }
}

async function restoreLines(tx: Tx, nurseryId: string, orderId: string, lines: Line[], actorEmail?: string | null) {
  for (const l of lines) {
    await tx.nurseryProduct.updateMany({
      where: { id: l.nurseryProductId, nurseryId },
      data: { stockQuantity: { increment: l.quantity } },
    });
    await movement(tx, { nurseryId, nurseryProductId: l.nurseryProductId, orderId, reason: 'RESTORE_CANCELLED', onHandDelta: l.quantity, actorEmail });
  }
}

// ---------- פקיעת שמירות ----------

/**
 * משחרר שמירות שפגו (R05-08). ההזמנה עצמה נשארת פתוחה ("התקבלה") — החלטת בעלים:
 * שחרור מלאי בלי ביטול. אישור מאוחר יותר ינסה לשמור מחדש. בטוח להרצה מקבילה:
 * המעבר RESERVED→RELEASED מותנה, כך שכל הזמנה משוחררת פעם אחת בלבד.
 */
export async function releaseExpiredReservations(
  db: PrismaClient,
  opts: { nurseryId?: string; now?: Date; limit?: number } = {},
): Promise<number> {
  const now = opts.now ?? new Date();
  const due = await db.order.findMany({
    where: {
      stockState: 'RESERVED',
      reservationExpiresAt: { lt: now },
      ...(opts.nurseryId ? { nurseryId: opts.nurseryId } : {}),
    },
    select: { id: true },
    take: opts.limit ?? 50,
  });
  let released = 0;
  for (const { id } of due) {
    const done = await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) return false;
      const res = await tx.order.updateMany({
        where: { id, stockState: 'RESERVED', reservationExpiresAt: { lt: now } },
        data: { stockState: 'RELEASED', reservationExpiresAt: null },
      });
      if (res.count !== 1) return false;
      await releaseLines(tx, order.nurseryId, id, order.items, 'RELEASE_EXPIRED');
      return true;
    });
    if (done) released++;
  }
  return released;
}

// ---------- יצירת הזמנה ----------

export interface CreateOrderInput {
  nurseryId: string;
  isQuote: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: DeliveryChoice;
  shippingAddress: string | null;
  shippingZone: (ShippingZoneForCheckout & { id: string }) | null;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  couponCode?: string | null;
  items: Array<{ productId: string; quantity: number }>;
  /** מפתח ייחודי לניסיון checkout — ניסיון חוזר מחזיר את אותה הזמנה */
  idempotencyKey?: string | null;
  now?: Date;
}

export type CreateOrderResult = { orderId: string; reused: boolean };

const IDEMPOTENCY_RE = /^[A-Za-z0-9_-]{8,64}$/;

export async function createOrderRecord(db: PrismaClient, input: CreateOrderInput): Promise<CreateOrderResult> {
  const now = input.now ?? new Date();
  const key = input.idempotencyKey && IDEMPOTENCY_RE.test(input.idempotencyKey) ? input.idempotencyKey : null;

  if (key) {
    const existing = await db.order.findUnique({
      where: { nurseryId_idempotencyKey: { nurseryId: input.nurseryId, idempotencyKey: key } },
      select: { id: true },
    });
    if (existing) return { orderId: existing.id, reused: true };
  }

  // שמירות שפגו משוחררות לפני בדיקת הזמינות, כדי שהזמין יהיה מדויק
  if (!input.isQuote) await releaseExpiredReservations(db, { nurseryId: input.nurseryId, now });

  try {
    const orderId = await db.$transaction(async (tx) => {
      const products = await tx.nurseryProduct.findMany({
        where: { id: { in: input.items.map((c) => c.productId) }, nurseryId: input.nurseryId, isActive: true },
        include: { plant: true, supply: true },
      });
      const byId = new Map(
        products.map((p) => [
          p.id,
          {
            id: p.id,
            title: resolveProductContent(p).title,
            price: Number(p.price),
            // הזמין למכירה = on_hand פחות מה שכבר שמור להזמנות אחרות
            stockQuantity: p.stockQuantity - p.reservedQuantity,
          },
        ]),
      );

      const lineItems = buildLineItems(input.items, byId, { isQuote: input.isQuote });
      const subtotal = calcSubtotal(lineItems);
      let total = subtotal;
      let coupon: { id: string; code: string; discountPct: number } | null = null;

      if (!input.isQuote && input.couponCode?.trim()) {
        const c = await tx.coupon.findFirst({
          where: { nurseryId: input.nurseryId, code: input.couponCode.trim(), isActive: true },
        });
        if (!c) throw new CheckoutError('קוד קופון לא תקף');
        assertCouponValid(c, now);
        assertCouponMinOrder(c.minOrderAmount === null ? null : Number(c.minOrderAmount), subtotal);

        // העדכון הראשון נועל את שורת הקופון עד סוף הטרנזקציה — כך גם בדיקת המגבלה
        // ללקוח (שאחריו) מסודרת בין הזמנות מקבילות של אותו קופון
        if (c.usageLimit !== null) {
          const res = await tx.coupon.updateMany({
            where: { id: c.id, usageCount: { lt: c.usageLimit } },
            data: { usageCount: { increment: 1 } },
          });
          if (res.count !== 1) throw new CheckoutError('קוד קופון מוצה');
        } else {
          await tx.coupon.update({ where: { id: c.id }, data: { usageCount: { increment: 1 } } });
        }

        if (c.perCustomerLimit !== null) {
          const used = await tx.order.count({
            where: {
              nurseryId: input.nurseryId,
              couponId: c.id,
              customerEmail: input.customerEmail,
              status: { not: 'CANCELLED' },
            },
          });
          if (used >= c.perCustomerLimit) throw new CheckoutError('כבר נעשה שימוש בקופון זה עבור כתובת האימייל הזו');
        }

        total = applyDiscount(subtotal, Number(c.discountPct));
        coupon = { id: c.id, code: c.code, discountPct: Number(c.discountPct) };
      }

      let shippingCost = 0;
      if (input.shippingZone && !input.isQuote) {
        shippingCost = resolveShippingCost(total, input.shippingZone);
        total += shippingCost;
      }

      const order = await tx.order.create({
        data: {
          nurseryId: input.nurseryId,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          deliveryMethod: input.deliveryMethod,
          shippingAddress: input.shippingAddress,
          status: input.isQuote ? 'QUOTE_REQUESTED' : 'RECEIVED',
          paymentStatus: 'UNPAID',
          stockState: input.isQuote ? 'NONE' : 'RESERVED',
          reservationExpiresAt: input.isQuote ? null : reservationExpiry(now),
          idempotencyKey: key,
          subtotalAmount: subtotal.toFixed(2),
          discountPct: coupon ? coupon.discountPct.toFixed(2) : null,
          discountAmount: coupon ? (subtotal - applyDiscount(subtotal, coupon.discountPct)).toFixed(2) : null,
          couponCode: coupon?.code ?? null,
          couponId: coupon?.id ?? null,
          totalAmount: total.toFixed(2),
          paymentMethod: input.paymentMethod,
          paymentReference: input.paymentReference,
          shippingZoneId: input.shippingZone?.id ?? null,
          shippingCost: input.shippingZone && !input.isQuote ? shippingCost.toFixed(2) : null,
          items: { create: lineItems },
        },
      });

      if (!input.isQuote) await reserveLines(tx, input.nurseryId, order.id, lineItems);
      return order.id;
    });
    return { orderId, reused: false };
  } catch (e) {
    // מרוץ על אותו מפתח: הניסיון השני נופל על האילוץ הייחודי — מחזירים את ההזמנה שנוצרה
    if (key && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existing = await db.order.findUnique({
        where: { nurseryId_idempotencyKey: { nurseryId: input.nurseryId, idempotencyKey: key } },
        select: { id: true },
      });
      if (existing) return { orderId: existing.id, reused: true };
    }
    throw e;
  }
}

// ---------- מעברי סטטוס ----------

export type TransitionResult = { ok: true; from: OrderStatus } | { ok: false; error: string };

export async function transitionOrder(
  db: PrismaClient,
  args: { nurseryId: string; orderId: string; to: OrderStatus; actorEmail?: string | null; now?: Date },
): Promise<TransitionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: args.orderId, nurseryId: args.nurseryId },
        include: { items: true },
      });
      if (!order) return { ok: false as const, error: 'ההזמנה לא נמצאה' };
      const from = order.status;
      if (!canTransition(from, args.to)) {
        return {
          ok: false as const,
          error: `לא ניתן לעבור מ"${ORDER_STATUS_LABELS[normalizeStatus(from)]}" ל"${ORDER_STATUS_LABELS[args.to]}"`,
        };
      }

      const effect = stockEffectFor(args.to, order.stockState);
      const nextStock =
        effect === 'release' || effect === 'restore'
          ? 'RELEASED'
          : effect === 'commit'
            ? 'COMMITTED'
            : effect === 'reserve' || effect === 'extend'
              ? 'RESERVED'
              : order.stockState;

      // עדכון מותנה בסטטוס ובמצב המלאי הנוכחיים — שני עדכונים מקבילים לא יחילו את אותו מעבר פעמיים
      const res = await tx.order.updateMany({
        where: { id: order.id, status: from, stockState: order.stockState },
        data: {
          status: args.to,
          stockState: nextStock,
          ...(effect === 'reserve' || effect === 'extend' ? { reservationExpiresAt: null } : {}),
          ...(effect === 'release' || effect === 'restore' || effect === 'commit' ? { reservationExpiresAt: null } : {}),
        },
      });
      if (res.count !== 1) return { ok: false as const, error: 'ההזמנה עודכנה במקביל — רעננו ונסו שוב' };

      if (effect === 'reserve') await reserveLines(tx, order.nurseryId, order.id, order.items, args.actorEmail);
      if (effect === 'release') await releaseLines(tx, order.nurseryId, order.id, order.items, 'RELEASE_CANCELLED', args.actorEmail);
      if (effect === 'restore') await restoreLines(tx, order.nurseryId, order.id, order.items, args.actorEmail);
      if (effect === 'commit') await commitLines(tx, order.nurseryId, order.id, order.items, args.actorEmail);

      // ביטול מחזיר את השימוש בקופון (פעם אחת — מעבר לבוטלה אפשרי פעם אחת בלבד)
      if (args.to === 'CANCELLED' && order.couponId) {
        await tx.coupon.updateMany({
          where: { id: order.couponId, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
      }
      return { ok: true as const, from };
    });
  } catch (e) {
    if (e instanceof CheckoutError) {
      return { ok: false, error: `${e.message} — עדכנו מלאי או בטלו את ההזמנה` };
    }
    throw e;
  }
}

export async function setPaymentStatus(
  db: PrismaClient,
  args: { nurseryId: string; orderId: string; to: PaymentStatus },
): Promise<{ ok: true; from: PaymentStatus } | { ok: false; error: string }> {
  const order = await db.order.findFirst({
    where: { id: args.orderId, nurseryId: args.nurseryId },
    select: { paymentStatus: true },
  });
  if (!order) return { ok: false, error: 'ההזמנה לא נמצאה' };
  if (!allowedNextPaymentStatuses(order.paymentStatus).includes(args.to)) {
    return { ok: false, error: 'מעבר סטטוס תשלום לא חוקי' };
  }
  const res = await db.order.updateMany({
    where: { id: args.orderId, nurseryId: args.nurseryId, paymentStatus: order.paymentStatus },
    data: { paymentStatus: args.to },
  });
  if (res.count !== 1) return { ok: false, error: 'ההזמנה עודכנה במקביל — רעננו ונסו שוב' };
  return { ok: true, from: order.paymentStatus };
}

// ---------- עדכון מלאי ידני ----------

/** עדכון on_hand בידי בעל המשתלה — לא מתחת לכמות השמורה; נרשם כתנועה. */
export async function setOnHandStock(
  db: PrismaClient,
  args: { nurseryId: string; productId: string; quantity: number; actorEmail?: string | null },
): Promise<{ ok: true; delta: number } | { ok: false; error: string }> {
  if (!Number.isInteger(args.quantity) || args.quantity < 0) return { ok: false, error: 'כמות מלאי לא תקינה' };
  return db.$transaction(async (tx) => {
    const p = await tx.nurseryProduct.findFirst({
      where: { id: args.productId, nurseryId: args.nurseryId },
      select: { stockQuantity: true, reservedQuantity: true },
    });
    if (!p) return { ok: false as const, error: 'המוצר לא נמצא' };
    if (args.quantity < p.reservedQuantity) {
      return { ok: false as const, error: `${p.reservedQuantity} יחידות שמורות להזמנות פתוחות — לא ניתן להוריד מתחת לכך` };
    }
    const delta = args.quantity - p.stockQuantity;
    if (delta === 0) return { ok: true as const, delta };
    const res = await tx.nurseryProduct.updateMany({
      where: { id: args.productId, nurseryId: args.nurseryId, stockQuantity: p.stockQuantity, reservedQuantity: { lte: args.quantity } },
      data: { stockQuantity: args.quantity },
    });
    if (res.count !== 1) return { ok: false as const, error: 'המלאי השתנה במקביל — רעננו ונסו שוב' };
    await movement(tx, {
      nurseryId: args.nurseryId,
      nurseryProductId: args.productId,
      reason: 'MANUAL_ADJUST',
      onHandDelta: delta,
      actorEmail: args.actorEmail,
    });
    return { ok: true as const, delta };
  });
}
