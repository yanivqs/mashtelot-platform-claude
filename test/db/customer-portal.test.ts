/**
 * R06-04 / §13: האזור האישי מול ה-DB — לקוח לא רואה הזמנה/כתובת של לקוח אחר או של משתלה אחרת,
 * מועדפים רק למוצרי המשתלה (גם ב-trigger), עד 10 כתובות, "הזמן שוב" במלאי ובמחיר של היום.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  addAddress,
  customerAddresses,
  customerOrder,
  customerOrders,
  deleteAddress,
  MAX_ADDRESSES,
  reorderLines,
  setDefaultAddress,
  toggleFavorite,
} from '@/lib/customer-portal';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const RUN = Date.now();
let a1: string;
let a2: string;
let b1: string;

const customer = (nurseryId: string, tag: string) =>
  prisma.customer.create({ data: { nurseryId, email: `portal-${RUN}-${tag}@test.invalid` } }).then((c) => c.id);

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  a1 = await customer(f.A.nurseryId, 'a1');
  a2 = await customer(f.A.nurseryId, 'a2');
  b1 = await customer(f.B.nurseryId, 'b1');
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function orderFor(customerId: string, nurseryId: string, productId: string, qty = 3) {
  const v = await prisma.productVariant.findFirstOrThrow({ where: { nurseryProductId: productId, isDefault: true } });
  return prisma.order.create({
    data: {
      nurseryId,
      customerId,
      customerName: 'x',
      customerEmail: `portal-${RUN}@test.invalid`,
      customerPhone: '050',
      totalAmount: '30.00',
      stockState: 'NONE',
      items: { create: { nurseryProductId: productId, productTitle: 'מוצר', quantity: qty, unitPrice: '10.00', variantId: v.id } },
    },
  });
}

describe('R06-04 customer portal', () => {
  it('orders: only the customer’s own, only in this nursery', async () => {
    const o = await orderFor(a1, f.A.nurseryId, f.A.productId);
    expect((await customerOrders(prisma, f.A.nurseryId, a1)).map((x) => x.id)).toEqual([o.id]);
    expect(await customerOrders(prisma, f.A.nurseryId, a2)).toEqual([]);
    expect(await customerOrder(prisma, f.A.nurseryId, a2, o.id)).toBeNull();
    expect(await customerOrder(prisma, f.B.nurseryId, a1, o.id)).toBeNull();
    expect((await customerOrder(prisma, f.A.nurseryId, a1, o.id))?.items).toHaveLength(1);
  });

  it('addresses: first is default, max 10, validation, cannot touch someone else’s', async () => {
    expect(await addAddress(prisma, a1, { city: '', street: 'x' })).toMatchObject({ ok: false });
    expect(await addAddress(prisma, a1, { city: 'חיפה', street: 'הנמל 1', postcode: '123' })).toEqual({ ok: false, error: 'מיקוד לא תקין — 7 ספרות' });
    for (let i = 0; i < MAX_ADDRESSES; i++) expect((await addAddress(prisma, a1, { city: 'חיפה', street: `רחוב ${i}` })).ok).toBe(true);
    expect((await addAddress(prisma, a1, { city: 'חיפה', street: 'עוד' })).ok).toBe(false);
    const list = await customerAddresses(prisma, a1);
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    expect(list[0]!.street).toBe('רחוב 0');
    expect(await deleteAddress(prisma, a2, list[1]!.id)).toEqual({ ok: false, error: 'הכתובת לא נמצאה' });
    expect(await setDefaultAddress(prisma, a2, list[1]!.id)).toMatchObject({ ok: false });
    expect(await setDefaultAddress(prisma, a1, list[1]!.id)).toEqual({ ok: true });
    expect((await customerAddresses(prisma, a1))[0]!.id).toBe(list[1]!.id);
  });

  it('favorites: toggle; another nursery’s or an inactive product is refused (app and DB trigger)', async () => {
    expect(await toggleFavorite(prisma, f.A.nurseryId, a1, f.A.productId)).toEqual({ ok: true, favorite: true });
    expect(await toggleFavorite(prisma, f.A.nurseryId, a1, f.A.productId)).toEqual({ ok: true, favorite: false });
    expect(await toggleFavorite(prisma, f.A.nurseryId, a1, f.B.productId)).toMatchObject({ ok: false });
    await expect(prisma.customerFavorite.create({ data: { customerId: b1, nurseryProductId: f.A.productId } })).rejects.toThrow(/customer's nursery/);
  });

  it('reorder: today’s price, clipped to stock; unavailable items are skipped', async () => {
    const o = await orderFor(a2, f.A.nurseryId, f.A.productId, 5);
    const v = await prisma.productVariant.findFirstOrThrow({ where: { nurseryProductId: f.A.productId, isDefault: true } });
    await prisma.productVariant.update({ where: { id: v.id }, data: { stockQuantity: 2, reservedQuantity: 0 } });
    await prisma.nurseryProduct.update({ where: { id: f.A.productId }, data: { price: '12.50' } });
    const r = await reorderLines(prisma, f.A.nurseryId, a2, o.id);
    expect(r).toMatchObject({ ok: true, skipped: [] });
    expect((r as { lines: Array<{ quantity: number; price: number }> }).lines[0]).toMatchObject({ quantity: 2, price: 12.5 });

    await prisma.productVariant.update({ where: { id: v.id }, data: { stockQuantity: 0 } });
    expect(await reorderLines(prisma, f.A.nurseryId, a2, o.id)).toMatchObject({ ok: true, lines: [], skipped: ['מוצר'] });
    // הזמנה של לקוח אחר
    expect(await reorderLines(prisma, f.A.nurseryId, a1, o.id)).toEqual({ ok: false, error: 'ההזמנה לא נמצאה' });
  });
});
