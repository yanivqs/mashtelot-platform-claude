/**
 * R06-06/07 מול ה-DB: הנחת קבוצה בהזמנה, מימוש נקודות (תקרה, יתרה, במקביל), צבירה כשנמסרה (פעם אחת),
 * ביטול מחזיר מימוש ומבטל צבירה, יומן לא ניתן לעריכה, מודול כבוי/שווי 0 → אין מועדון.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrderRecord, transitionOrder, type CreateOrderInput } from '@/lib/order-service';
import { adjustPoints } from '@/lib/crm';
import { balanceOf } from '@/lib/loyalty';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
let customerId: string;
const EMAIL = `loyal-${randomUUID().slice(0, 8)}@test.invalid`;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  await prisma.nurseryModule.create({ data: { nurseryId: f.A.nurseryId, moduleKey: 'loyalty', isEnabled: true } });
  await prisma.loyaltySettings.create({ data: { nurseryId: f.A.nurseryId, pointsPerShekel: 1, pointValue: 0.05, maxRedeemPct: 50 } });
  const g = await prisma.customerGroup.create({ data: { nurseryId: f.A.nurseryId, name: 'עסקיים', discountPct: 10 } });
  customerId = (await prisma.customer.create({ data: { nurseryId: f.A.nurseryId, email: EMAIL, groupId: g.id } })).id;
});

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function product(stock = 50) {
  return prisma.nurseryProduct.create({ data: { nurseryId: f.A.nurseryId, customTitle: `מוצר ${randomUUID().slice(0, 6)}`, price: '100.00', stockQuantity: stock } });
}

function input(productId: string, over: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    nurseryId: f.A.nurseryId,
    isQuote: false,
    customerName: 'חבר מועדון',
    customerEmail: EMAIL,
    customerPhone: '050',
    deliveryMethod: 'PICKUP',
    shippingAddress: null,
    shippingZone: null,
    paymentMethod: null,
    paymentReference: null,
    items: [{ productId, quantity: 1 }],
    customerId,
    applyGroupDiscount: true,
    ...over,
  };
}

async function deliver(orderId: string) {
  for (const to of ['CONFIRMED', 'READY', 'DELIVERED'] as const) {
    expect(await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to })).toMatchObject({ ok: true });
  }
}

describe('R06-06/07 loyalty and group pricing', () => {
  it('group discount 10% before the coupon; snapshot on the order', async () => {
    const p = await product();
    const { orderId } = await createOrderRecord(prisma, input(p.id));
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect([Number(o.subtotalAmount), Number(o.groupDiscountPct), Number(o.groupDiscountAmount), Number(o.totalAmount)]).toEqual([100, 10, 10, 90]);
    // בלי הדגל (מודול CRM כבוי) — בלי הנחה
    const r2 = await createOrderRecord(prisma, input(p.id, { applyGroupDiscount: false }));
    expect(Number((await prisma.order.findUniqueOrThrow({ where: { id: r2.orderId } })).totalAmount)).toBe(100);
  });

  it('earn on delivered, once; points on what was paid for items', async () => {
    const p = await product();
    const { orderId } = await createOrderRecord(prisma, input(p.id));
    expect(await balanceOf(prisma, customerId)).toBe(0);
    await deliver(orderId);
    expect(await balanceOf(prisma, customerId)).toBe(90);
    expect(await prisma.loyaltyEntry.count({ where: { orderId, kind: 'EARN' } })).toBe(1);
  });

  it('redeem: capped by % and balance; two concurrent redemptions cannot overspend', async () => {
    const p = await product();
    // 90 ₪ אחרי הנחת קבוצה, תקרה 50% = 45 ₪ = 900 נקודות; היתרה 90
    await expect(createOrderRecord(prisma, input(p.id, { redeemPoints: 91 }))).rejects.toThrow(/עד 90 נקודות/);
    const results = await Promise.allSettled([
      createOrderRecord(prisma, input(p.id, { redeemPoints: 60, idempotencyKey: `k-${randomUUID()}` })),
      createOrderRecord(prisma, input(p.id, { redeemPoints: 60, idempotencyKey: `k-${randomUUID()}` })),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balanceOf(prisma, customerId)).toBe(30);
    const ok = results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ orderId: string }>;
    const o = await prisma.order.findUniqueOrThrow({ where: { id: ok.value.orderId } });
    expect([o.loyaltyPointsUsed, Number(o.loyaltyDiscount), Number(o.totalAmount)]).toEqual([60, 3, 87]);

    // ביטול מחזיר את הנקודות (פעם אחת)
    expect(await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: o.id, to: 'CANCELLED' })).toMatchObject({ ok: true });
    expect(await balanceOf(prisma, customerId)).toBe(90);
    expect(await prisma.loyaltyEntry.count({ where: { orderId: o.id, kind: 'REFUND_REDEEM' } })).toBe(1);
  });

  it('a guest (no customer) cannot redeem; the ledger is immutable and nursery-bound', async () => {
    const p = await product();
    await expect(createOrderRecord(prisma, input(p.id, { customerId: null, redeemPoints: 5 }))).rejects.toThrow(/לקוח מחובר/);
    const e = await prisma.loyaltyEntry.findFirstOrThrow({ where: { customerId } });
    await expect(prisma.loyaltyEntry.update({ where: { id: e.id }, data: { points: 1000 } })).rejects.toThrow(/immutable/);
    const bCustomer = await prisma.customer.create({ data: { nurseryId: f.B.nurseryId, email: `b-${EMAIL}` } });
    await expect(prisma.loyaltyEntry.create({ data: { nurseryId: f.A.nurseryId, customerId: bCustomer.id, kind: 'ADJUST', points: 5 } })).rejects.toThrow(/belong to the nursery/);
    await expect(prisma.loyaltyEntry.create({ data: { nurseryId: f.A.nurseryId, customerId, kind: 'ADJUST', points: 0 } })).rejects.toThrow();
  });

  it('manual adjust: reason required, cannot go below zero', async () => {
    expect(await adjustPoints(prisma, f.A.nurseryId, EMAIL, 10, '', 'o@x')).toEqual({ ok: false, error: 'יש לכתוב סיבה' });
    expect(await adjustPoints(prisma, f.A.nurseryId, EMAIL, -1000, 'תיקון', 'o@x')).toEqual({ ok: false, error: 'אין מספיק נקודות' });
    expect(await adjustPoints(prisma, f.A.nurseryId, EMAIL, 10, 'מתנת יום הולדת', 'o@x')).toEqual({ ok: true });
    expect(await balanceOf(prisma, customerId)).toBe(100);
  });

  it('club off (point value 0 or module disabled) → no earning, no redeeming', async () => {
    await prisma.loyaltySettings.update({ where: { nurseryId: f.A.nurseryId }, data: { pointValue: 0 } });
    const p = await product();
    await expect(createOrderRecord(prisma, input(p.id, { redeemPoints: 5 }))).rejects.toThrow(/אינו פעיל/);
    const { orderId } = await createOrderRecord(prisma, input(p.id));
    await deliver(orderId);
    expect(await prisma.loyaltyEntry.count({ where: { orderId } })).toBe(0);
  });
});
