/**
 * מחיקת הזמנה לצמיתות מול ה-DB: ביטול קודם (שחרור מלאי שמור), קיזוז נקודות שנצברו והחזרת נקודות שמומשו,
 * יומן הנקודות נשמר (order_id מתאפס), ומשתלה אחרת לא יכולה למחוק.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrderRecord, deleteOrder, transitionOrder, type CreateOrderInput } from '@/lib/order-service';
import { balanceOf } from '@/lib/loyalty';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
let customerId: string;
const EMAIL = `del-${randomUUID().slice(0, 8)}@test.invalid`;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  await prisma.nurseryModule.create({ data: { nurseryId: f.A.nurseryId, moduleKey: 'loyalty', isEnabled: true } });
  await prisma.loyaltySettings.create({ data: { nurseryId: f.A.nurseryId, pointsPerShekel: 1, pointValue: 0.05, maxRedeemPct: 50 } });
  customerId = (await prisma.customer.create({ data: { nurseryId: f.A.nurseryId, email: EMAIL } })).id;
});

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function product(stock = 20) {
  return prisma.nurseryProduct.create({ data: { nurseryId: f.A.nurseryId, customTitle: `מוצר ${randomUUID().slice(0, 6)}`, price: '100.00', stockQuantity: stock } });
}

function input(productId: string, over: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    nurseryId: f.A.nurseryId,
    isQuote: false,
    customerName: 'לקוח למחיקה',
    customerEmail: EMAIL,
    customerPhone: '050',
    deliveryMethod: 'PICKUP',
    shippingAddress: null,
    shippingZone: null,
    paymentMethod: null,
    paymentReference: null,
    items: [{ productId, quantity: 2 }],
    customerId,
    ...over,
  };
}

describe('delete order permanently', () => {
  it('delivered order: earned points are reversed, ledger kept, order gone', async () => {
    const p = await product();
    const { orderId } = await createOrderRecord(prisma, input(p.id));
    for (const to of ['CONFIRMED', 'READY', 'DELIVERED'] as const) {
      expect(await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to })).toMatchObject({ ok: true });
    }
    expect(await balanceOf(prisma, customerId)).toBe(200);

    const res = await deleteOrder(prisma, { nurseryId: f.A.nurseryId, orderId, actorEmail: 'owner@x' });
    expect(res).toMatchObject({ ok: true, snapshot: { customerName: 'לקוח למחיקה', status: 'DELIVERED' } });
    expect(await prisma.order.count({ where: { id: orderId } })).toBe(0);
    expect(await prisma.orderItem.count({ where: { orderId } })).toBe(0);
    expect(await balanceOf(prisma, customerId)).toBe(0);
    const kinds = (await prisma.loyaltyEntry.findMany({ where: { customerId, orderId: null } })).map((e) => e.kind).sort();
    expect(kinds).toEqual(['EARN', 'REVERSE_EARN']);
  });

  it('open order with redeemed points: cancelled first — stock released and points refunded', async () => {
    await prisma.loyaltyEntry.create({ data: { nurseryId: f.A.nurseryId, customerId, kind: 'ADJUST', points: 300, note: 'בדיקה' } });
    const p = await product(20);
    const { orderId } = await createOrderRecord(prisma, input(p.id, { redeemPoints: 100 }));
    expect(await balanceOf(prisma, customerId)).toBe(200);
    expect(await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId, to: 'CONFIRMED' })).toMatchObject({ ok: true });
    expect((await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: p.id } })).reservedQuantity).toBe(2);

    expect(await deleteOrder(prisma, { nurseryId: f.A.nurseryId, orderId })).toMatchObject({ ok: true });
    expect(await balanceOf(prisma, customerId)).toBe(300);
    const after = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: p.id } });
    expect([after.stockQuantity, after.reservedQuantity]).toEqual([20, 0]);
  });

  it('another nursery cannot delete the order', async () => {
    const p = await product();
    const { orderId } = await createOrderRecord(prisma, input(p.id, { customerId: null }));
    expect(await deleteOrder(prisma, { nurseryId: f.B.nurseryId, orderId })).toEqual({ ok: false, error: 'ההזמנה לא נמצאה' });
    expect(await prisma.order.count({ where: { id: orderId } })).toBe(1);
  });
});
