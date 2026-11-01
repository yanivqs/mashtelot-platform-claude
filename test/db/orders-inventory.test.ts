/**
 * C-P1-02: הזמנות ומלאי מול בסיס נתונים (אפיון §8, §9, §12.01, R05-07, R05-08, §26 שערי קבלה).
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  createOrderRecord,
  releaseExpiredReservations,
  setOnHandStock,
  setPaymentStatus,
  transitionOrder,
  type CreateOrderInput,
} from '@/lib/order-service';
import { CheckoutError } from '@/lib/checkout-calc';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId, f.C.nurseryId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function newProduct(nurseryId: string, stock: number) {
  return prisma.nurseryProduct.create({
    data: { nurseryId, customTitle: `מוצר ${randomUUID().slice(0, 6)}`, price: '100.00', stockQuantity: stock },
  });
}

function orderInput(over: Partial<CreateOrderInput> & { productId: string; quantity?: number }): CreateOrderInput {
  const { productId, quantity = 1, ...rest } = over;
  return {
    nurseryId: f.A.nurseryId,
    isQuote: false,
    customerName: 'לקוח',
    customerEmail: `buyer-${randomUUID().slice(0, 6)}@example.invalid`,
    customerPhone: '050-0000000',
    deliveryMethod: 'PICKUP',
    shippingAddress: null,
    shippingZone: null,
    paymentMethod: null,
    paymentReference: null,
    items: [{ productId, quantity }],
    ...rest,
  };
}

async function stockOf(id: string) {
  return prisma.nurseryProduct.findUniqueOrThrow({ where: { id }, select: { stockQuantity: true, reservedQuantity: true } });
}

async function orderOf(id: string) {
  return prisma.order.findUniqueOrThrow({ where: { id } });
}

describe('C-P1-02 reservation on order creation (R05-08)', () => {
  it('reserves without touching on_hand, expires in 48h, records a movement and a snapshot', async () => {
    const p = await newProduct(f.A.nurseryId, 10);
    const now = new Date('2026-10-18T10:00:00Z');
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 2, now }));
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 10, reservedQuantity: 2 });
    const o = await orderOf(orderId);
    expect(o.status).toBe('RECEIVED');
    expect(o.paymentStatus).toBe('UNPAID');
    expect(o.stockState).toBe('RESERVED');
    expect(o.reservationExpiresAt?.toISOString()).toBe('2026-10-20T10:00:00.000Z');
    expect(Number(o.subtotalAmount)).toBe(200);
    const mv = await prisma.stockMovement.findMany({ where: { orderId } });
    expect(mv.map((m) => [m.reason, m.reservedDelta, m.onHandDelta])).toEqual([['RESERVE', 2, 0]]);
  });

  it('two concurrent orders for the last unit: exactly one succeeds (no overselling)', async () => {
    const p = await newProduct(f.A.nurseryId, 1);
    const results = await Promise.allSettled([
      createOrderRecord(prisma, orderInput({ productId: p.id })),
      createOrderRecord(prisma, orderInput({ productId: p.id })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(CheckoutError);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 1, reservedQuantity: 1 });
  });

  it('available = on_hand − reserved: a second buyer cannot take reserved units', async () => {
    const p = await newProduct(f.A.nurseryId, 3);
    await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 2 }));
    await expect(createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 2 }))).rejects.toBeInstanceOf(CheckoutError);
    await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 1 }));
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 3, reservedQuantity: 3 });
  });
});

describe('C-P1-02 idempotency (§9 — no duplicate order from a retry)', () => {
  it('the same key twice returns the same order and reserves once', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const key = randomUUID();
    const first = await createOrderRecord(prisma, orderInput({ productId: p.id, idempotencyKey: key }));
    const second = await createOrderRecord(prisma, orderInput({ productId: p.id, idempotencyKey: key }));
    expect(second).toEqual({ orderId: first.orderId, reused: true });
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
    expect((await stockOf(p.id)).reservedQuantity).toBe(1);
  });

  it('concurrent retries with the same key create a single order', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const key = randomUUID();
    const [a, b] = await Promise.all([
      createOrderRecord(prisma, orderInput({ productId: p.id, idempotencyKey: key })),
      createOrderRecord(prisma, orderInput({ productId: p.id, idempotencyKey: key })),
    ]);
    expect(a.orderId).toBe(b.orderId);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
    expect((await stockOf(p.id)).reservedQuantity).toBe(1);
  });

  it('keys are scoped per nursery', async () => {
    const pa = await newProduct(f.A.nurseryId, 5);
    const pb = await newProduct(f.B.nurseryId, 5);
    const key = randomUUID();
    const a = await createOrderRecord(prisma, orderInput({ productId: pa.id, idempotencyKey: key }));
    const b = await createOrderRecord(prisma, orderInput({ nurseryId: f.B.nurseryId, productId: pb.id, idempotencyKey: key }));
    expect(a.orderId).not.toBe(b.orderId);
  });
});

describe('C-P1-02 expiry: release stock, keep the order open', () => {
  it('releases expired reservations once; the order stays RECEIVED', async () => {
    const p = await newProduct(f.A.nurseryId, 4);
    const created = new Date(Date.now() - 49 * 3600_000);
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 3, now: created }));
    expect(await releaseExpiredReservations(prisma, { nurseryId: f.A.nurseryId })).toBeGreaterThanOrEqual(1);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 4, reservedQuantity: 0 });
    const o = await orderOf(orderId);
    expect(o.status).toBe('RECEIVED');
    expect(o.stockState).toBe('RELEASED');
    expect(await releaseExpiredReservations(prisma, { nurseryId: f.A.nurseryId })).toBe(0);
    const reasons = (await prisma.stockMovement.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } })).map((m) => m.reason);
    expect(reasons).toEqual(['RESERVE', 'RELEASE_EXPIRED']);
  });

  it('confirming an expired order re-reserves — or fails if the stock is gone', async () => {
    const p = await newProduct(f.A.nurseryId, 2);
    const { orderId } = await createOrderRecord(
      prisma,
      orderInput({ productId: p.id, quantity: 2, now: new Date(Date.now() - 49 * 3600_000) }),
    );
    await releaseExpiredReservations(prisma, { nurseryId: f.A.nurseryId });
    // מישהו אחר קנה בינתיים
    await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 1 }));
    const fail = await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CONFIRMED' });
    expect(fail.ok).toBe(false);
    expect((await orderOf(orderId)).status).toBe('RECEIVED');

    await setOnHandStock(prisma, { nurseryId: f.A.nurseryId, productId: p.id, quantity: 3 });
    const ok = await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CONFIRMED' });
    expect(ok.ok).toBe(true);
    const o = await orderOf(orderId);
    expect([o.status, o.stockState, o.reservationExpiresAt]).toEqual(['CONFIRMED', 'RESERVED', null]);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 3, reservedQuantity: 3 });
  });
});

describe('C-P1-02 lifecycle and state machine', () => {
  it('confirm → prepare → ship commits stock exactly once; deliver does nothing more', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 2 }));
    for (const to of ['CONFIRMED', 'PREPARING', 'SHIPPED'] as const) {
      expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to })).ok).toBe(true);
    }
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 3, reservedQuantity: 0 });
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'DELIVERED' })).ok).toBe(true);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 3, reservedQuantity: 0 });
    expect((await orderOf(orderId)).stockState).toBe('COMMITTED');
  });

  it('pickup path: ready → delivered commits', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 1 }));
    for (const to of ['CONFIRMED', 'READY', 'DELIVERED'] as const) {
      expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to })).ok).toBe(true);
    }
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 4, reservedQuantity: 0 });
  });

  it('rejects illegal transitions (skip confirm, cancel after shipping)', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id }));
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'SHIPPED' })).ok).toBe(false);
    await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CONFIRMED' });
    await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'SHIPPED' });
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CANCELLED' })).ok).toBe(false);
  });

  it('cancel releases the reservation once; a second cancel is rejected', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 3 }));
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CANCELLED' })).ok).toBe(true);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 5, reservedQuantity: 0 });
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CANCELLED' })).ok).toBe(false);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 5, reservedQuantity: 0 });
  });

  it('cancelling a legacy order (stock already deducted) restores on_hand', async () => {
    const p = await newProduct(f.A.nurseryId, 4);
    const legacy = await prisma.order.create({
      data: {
        nurseryId: f.A.nurseryId,
        customerName: 'ישן',
        customerEmail: 'legacy@example.invalid',
        customerPhone: '1',
        totalAmount: '100.00',
        status: 'RECEIVED',
        stockState: 'COMMITTED',
        items: { create: [{ nurseryProductId: p.id, productTitle: 'x', quantity: 2, unitPrice: '50.00' }] },
      },
    });
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: legacy.id, to: 'CANCELLED' })).ok).toBe(true);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 6, reservedQuantity: 0 });
  });

  it('tenant B cannot transition or change payment of tenant A orders', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id }));
    expect(await transitionOrder(prisma, { nurseryId: f.B.nurseryId, orderId, to: 'CANCELLED' })).toEqual({
      ok: false,
      error: 'ההזמנה לא נמצאה',
    });
    expect((await setPaymentStatus(prisma, { nurseryId: f.B.nurseryId, orderId, to: 'PAID' })).ok).toBe(false);
    expect((await orderOf(orderId)).status).toBe('RECEIVED');
    expect((await stockOf(p.id)).reservedQuantity).toBe(1);
  });
});

describe('C-P1-02 payment status (separate axis)', () => {
  it('unpaid → paid → refunded; illegal jumps rejected; independent of fulfilment', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id }));
    expect((await setPaymentStatus(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'REFUNDED' })).ok).toBe(false);
    expect((await setPaymentStatus(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'PAID' })).ok).toBe(true);
    expect((await setPaymentStatus(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'REFUNDED' })).ok).toBe(true);
    const o = await orderOf(orderId);
    expect([o.status, o.paymentStatus]).toEqual(['RECEIVED', 'REFUNDED']);
  });
});

describe('C-P1-02 coupons (§12.01) and snapshot (§9.03)', () => {
  it('stores the coupon snapshot and restores usage once on cancel', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    await prisma.coupon.update({ where: { id: f.A.couponId }, data: { usageLimit: 5, usageCount: 0, minOrderAmount: null, perCustomerLimit: null } });
    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id, couponCode: 'CODEA' }));
    const o = await orderOf(orderId);
    expect([o.couponCode, Number(o.discountPct), Number(o.subtotalAmount), Number(o.discountAmount), Number(o.totalAmount)]).toEqual([
      'CODEA',
      10,
      100,
      10,
      90,
    ]);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: f.A.couponId } })).usageCount).toBe(1);
    await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CANCELLED' });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: f.A.couponId } })).usageCount).toBe(0);
  });

  it('minimum order amount is enforced', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    await prisma.coupon.update({ where: { id: f.A.couponId }, data: { minOrderAmount: '250.00', perCustomerLimit: null } });
    await expect(createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 2, couponCode: 'CODEA' }))).rejects.toThrow(/מעל/);
    await expect(createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 3, couponCode: 'CODEA' }))).resolves.toBeTruthy();
    await prisma.coupon.update({ where: { id: f.A.couponId }, data: { minOrderAmount: null } });
  });

  it('per-customer limit: same email blocked, other email allowed, cancelled orders do not count', async () => {
    const p = await newProduct(f.A.nurseryId, 10);
    await prisma.coupon.update({ where: { id: f.A.couponId }, data: { perCustomerLimit: 1, usageLimit: null } });
    const email = `repeat-${randomUUID().slice(0, 6)}@example.invalid`;
    const before = (await prisma.coupon.findUniqueOrThrow({ where: { id: f.A.couponId } })).usageCount;
    const first = await createOrderRecord(prisma, orderInput({ productId: p.id, couponCode: 'CODEA', customerEmail: email }));
    await expect(
      createOrderRecord(prisma, orderInput({ productId: p.id, couponCode: 'CODEA', customerEmail: email })),
    ).rejects.toThrow(/כבר נעשה שימוש/);
    // הניסיון שנדחה לא הותיר עליית שימוש או שמירת מלאי
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: f.A.couponId } })).usageCount).toBe(before + 1);
    expect((await stockOf(p.id)).reservedQuantity).toBe(1);
    await expect(createOrderRecord(prisma, orderInput({ productId: p.id, couponCode: 'CODEA' }))).resolves.toBeTruthy();
    await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: first.orderId, to: 'CANCELLED' });
    await expect(
      createOrderRecord(prisma, orderInput({ productId: p.id, couponCode: 'CODEA', customerEmail: email })),
    ).resolves.toBeTruthy();
    await prisma.coupon.update({ where: { id: f.A.couponId }, data: { perCustomerLimit: null } });
  });
});

describe('C-P1-02 manual stock edits', () => {
  it('cannot go below reserved units; changes are recorded as movements', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 4 }));
    expect((await setOnHandStock(prisma, { nurseryId: f.A.nurseryId, productId: p.id, quantity: 3 })).ok).toBe(false);
    expect(await setOnHandStock(prisma, { nurseryId: f.A.nurseryId, productId: p.id, quantity: 8, actorEmail: 'o@x' })).toEqual({
      ok: true,
      delta: 3,
    });
    const adj = await prisma.stockMovement.findFirst({ where: { nurseryProductId: p.id, reason: 'MANUAL_ADJUST' } });
    expect([adj?.onHandDelta, adj?.actorEmail]).toEqual([3, 'o@x']);
    expect((await setOnHandStock(prisma, { nurseryId: f.B.nurseryId, productId: p.id, quantity: 9 })).ok).toBe(false);
  });
});

describe('always in stock (no quantity tracking)', () => {
  it('sells beyond on_hand without reserving or deducting; confirm/ship/cancel leave stock untouched', async () => {
    const p = await newProduct(f.A.nurseryId, 0);
    await prisma.nurseryProduct.update({ where: { id: p.id }, data: { alwaysInStock: true } });

    const { orderId } = await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 5 }));
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 0, reservedQuantity: 0 });
    expect((await prisma.orderItem.findFirstOrThrow({ where: { orderId } })).stockTracked).toBe(false);
    for (const to of ['CONFIRMED', 'PREPARING', 'SHIPPED'] as const) {
      expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to })).ok).toBe(true);
    }
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 0, reservedQuantity: 0 });
    expect(await prisma.stockMovement.count({ where: { orderId } })).toBe(0);

    const second = await createOrderRecord(prisma, orderInput({ productId: p.id, quantity: 3 }));
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: second.orderId, to: 'CANCELLED' })).ok).toBe(true);
    expect(await stockOf(p.id)).toEqual({ stockQuantity: 0, reservedQuantity: 0 });
  });

  it('toggling the flag later does not break open orders (each line keeps its snapshot)', async () => {
    const tracked = await newProduct(f.A.nurseryId, 4);
    const { orderId: o1 } = await createOrderRecord(prisma, orderInput({ productId: tracked.id, quantity: 2 }));
    await prisma.nurseryProduct.update({ where: { id: tracked.id }, data: { alwaysInStock: true } });
    // ההזמנה נשמרה עם מעקב — הביטול משחרר את מה שנשמר
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: o1, to: 'CANCELLED' })).ok).toBe(true);
    expect(await stockOf(tracked.id)).toEqual({ stockQuantity: 4, reservedQuantity: 0 });

    const untracked = await newProduct(f.A.nurseryId, 1);
    await prisma.nurseryProduct.update({ where: { id: untracked.id }, data: { alwaysInStock: true } });
    const { orderId: o2 } = await createOrderRecord(prisma, orderInput({ productId: untracked.id, quantity: 3 }));
    await prisma.nurseryProduct.update({ where: { id: untracked.id }, data: { alwaysInStock: false } });
    // נוצרה בלי שמירה — האישור והמשלוח לא מורידים מלאי
    for (const to of ['CONFIRMED', 'PREPARING', 'SHIPPED'] as const) {
      expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: o2, to })).ok).toBe(true);
    }
    expect(await stockOf(untracked.id)).toEqual({ stockQuantity: 1, reservedQuantity: 0 });
  });
});
