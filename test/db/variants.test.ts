/**
 * §7.01 / §8.01 / §9.01: וריאנטים — triggers, שמירת מלאי לפי וריאנט, מחיר יורש, Snapshot,
 * בידוד בין משתלות, ייחודיות SKU, מחיקה/השבתה.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createOrderRecord, transitionOrder, type CreateOrderInput } from '@/lib/order-service';
import { deleteVariant, saveVariant } from '@/lib/variants-admin';
import type { VariantInput } from '@/lib/variants';
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

const run = randomUUID().slice(0, 6);

async function newProduct(nurseryId: string, stock: number, price = '100.00') {
  return prisma.nurseryProduct.create({
    data: { nurseryId, customTitle: `ורד ${randomUUID().slice(0, 6)}`, price, stockQuantity: stock },
  });
}

function input(over: Partial<VariantInput> = {}): VariantInput {
  return { name: 'עציץ 4 ליטר', sku: null, barcode: null, price: null, compareAtPrice: null, stockQuantity: 0, imageUrls: [], isActive: true, ...over };
}

async function addVariant(nurseryId: string, productId: string, over: Partial<VariantInput> = {}) {
  const res = await saveVariant(prisma, { nurseryId, productId, variantId: null, input: input(over) });
  if (!res.ok) throw new Error(res.error);
  return res.variantId;
}

function orderInput(items: CreateOrderInput['items'], nurseryId = f.A.nurseryId): CreateOrderInput {
  return {
    nurseryId,
    isQuote: false,
    customerName: 'לקוח',
    customerEmail: `buyer-${randomUUID().slice(0, 6)}@example.invalid`,
    customerPhone: '050-0000000',
    deliveryMethod: 'PICKUP',
    shippingAddress: null,
    shippingZone: null,
    paymentMethod: null,
    paymentReference: null,
    items,
  };
}

const productStock = (id: string) =>
  prisma.nurseryProduct.findUniqueOrThrow({ where: { id }, select: { stockQuantity: true, reservedQuantity: true } });
const variantStock = (id: string) =>
  prisma.productVariant.findUniqueOrThrow({ where: { id }, select: { stockQuantity: true, reservedQuantity: true } });
const defaultVariant = (productId: string) =>
  prisma.productVariant.findFirstOrThrow({ where: { nurseryProductId: productId, isDefault: true } });

describe('DB triggers', () => {
  it('a new product gets exactly one default variant with its stock', async () => {
    const p = await newProduct(f.A.nurseryId, 7);
    const vs = await prisma.productVariant.findMany({ where: { nurseryProductId: p.id } });
    expect(vs).toHaveLength(1);
    expect(vs[0]).toMatchObject({ isDefault: true, stockQuantity: 7, reservedQuantity: 0, price: null, nurseryId: f.A.nurseryId });
  });

  it('product stock = sum of active variants (add, deactivate)', async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const v2 = await addVariant(f.A.nurseryId, p.id, { stockQuantity: 3 });
    expect(await productStock(p.id)).toEqual({ stockQuantity: 8, reservedQuantity: 0 });
    await prisma.productVariant.update({ where: { id: v2 }, data: { isActive: false } });
    expect(await productStock(p.id)).toEqual({ stockQuantity: 5, reservedQuantity: 0 });
  });
});

describe('orders by variant', () => {
  it('reserves on the chosen variant, uses its own price, snapshots the variant name', async () => {
    const p = await newProduct(f.A.nurseryId, 10, '40.00');
    const big = await addVariant(f.A.nurseryId, p.id, { name: '4 ליטר', price: 55, stockQuantity: 4 });
    const { orderId } = await createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: big, quantity: 2 }]));

    expect(await variantStock(big)).toEqual({ stockQuantity: 4, reservedQuantity: 2 });
    expect((await defaultVariant(p.id)).reservedQuantity).toBe(0);
    expect(await productStock(p.id)).toEqual({ stockQuantity: 14, reservedQuantity: 2 });

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(item).toMatchObject({ variantId: big, variantName: '4 ליטר', quantity: 2 });
    expect(Number(item.unitPrice)).toBe(55);
    expect(item.productTitle).toContain('— 4 ליטר');
    const mv = await prisma.stockMovement.findFirstOrThrow({ where: { orderId } });
    expect(mv.variantId).toBe(big);
  });

  it('a variant without its own price inherits the product price', async () => {
    const p = await newProduct(f.A.nurseryId, 0, '30.00');
    const v = await addVariant(f.A.nurseryId, p.id, { name: 'מארז', stockQuantity: 5 });
    const { orderId } = await createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: v, quantity: 1 }]));
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(Number(item.unitPrice)).toBe(30);
  });

  it('cart lines without a variant (old carts) use the default variant', async () => {
    const p = await newProduct(f.A.nurseryId, 3);
    await addVariant(f.A.nurseryId, p.id, { name: 'גדול', stockQuantity: 3 });
    const { orderId } = await createOrderRecord(prisma, orderInput([{ productId: p.id, quantity: 1 }]));
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
    expect(item.variantId).toBe((await defaultVariant(p.id)).id);
  });

  it('two concurrent orders for the last unit of a variant: exactly one succeeds', async () => {
    const p = await newProduct(f.A.nurseryId, 50);
    const v = await addVariant(f.A.nurseryId, p.id, { name: 'אחרון', stockQuantity: 1 });
    const results = await Promise.allSettled([
      createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: v, quantity: 1 }])),
      createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: v, quantity: 1 }])),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await variantStock(v)).toEqual({ stockQuantity: 1, reservedQuantity: 1 });
    // וריאנט אחר של אותו מוצר לא הושפע
    expect((await defaultVariant(p.id)).reservedQuantity).toBe(0);
  });

  it("refuses another product's / another nursery's / an inactive variant", async () => {
    const p = await newProduct(f.A.nurseryId, 5);
    const other = await newProduct(f.A.nurseryId, 5);
    const otherVariant = (await defaultVariant(other.id)).id;
    await expect(
      createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: otherVariant, quantity: 1 }])),
    ).rejects.toThrow('אינו זמין');

    const bProduct = await newProduct(f.B.nurseryId, 5);
    const bVariant = (await defaultVariant(bProduct.id)).id;
    await expect(
      createOrderRecord(prisma, orderInput([{ productId: bProduct.id, variantId: bVariant, quantity: 1 }])),
    ).rejects.toThrow('אינו זמין');

    const inactive = await addVariant(f.A.nurseryId, p.id, { name: 'מושבת', stockQuantity: 5, isActive: false });
    await expect(
      createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: inactive, quantity: 1 }])),
    ).rejects.toThrow('אינו זמין');
  });

  it('cancel releases and fulfil commits on the same variant', async () => {
    const p = await newProduct(f.A.nurseryId, 0);
    const v = await addVariant(f.A.nurseryId, p.id, { name: 'X', stockQuantity: 5 });
    const a = await createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: v, quantity: 2 }]));
    expect((await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: a.orderId, to: 'CANCELLED' })).ok).toBe(true);
    expect(await variantStock(v)).toEqual({ stockQuantity: 5, reservedQuantity: 0 });

    const b = await createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: v, quantity: 2 }]));
    for (const to of ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'] as const) {
      const r = await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: b.orderId, to });
      expect(r.ok, to).toBe(true);
    }
    expect(await variantStock(v)).toEqual({ stockQuantity: 3, reservedQuantity: 0 });
    expect(await productStock(p.id)).toEqual({ stockQuantity: 3, reservedQuantity: 0 });
  });
});

describe('variant admin', () => {
  it('SKU is unique per nursery, but may repeat in another nursery', async () => {
    const p = await newProduct(f.A.nurseryId, 0);
    await addVariant(f.A.nurseryId, p.id, { name: 'א', sku: `SKU-${run}` });
    const dup = await saveVariant(prisma, { nurseryId: f.A.nurseryId, productId: p.id, variantId: null, input: input({ name: 'ב', sku: `SKU-${run}` }) });
    expect(dup).toEqual({ ok: false, error: 'ה-SKU כבר בשימוש במוצר אחר במשתלה' });
    const pb = await newProduct(f.B.nurseryId, 0);
    expect((await saveVariant(prisma, { nurseryId: f.B.nurseryId, productId: pb.id, variantId: null, input: input({ name: 'א', sku: `SKU-${run}` }) })).ok).toBe(true);
  });

  it('barcode keeps leading zeros', async () => {
    const p = await newProduct(f.A.nurseryId, 0);
    const id = await addVariant(f.A.nurseryId, p.id, { name: 'ברקוד', barcode: `00${run.replace(/\D/g, '1')}42` });
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id } })).barcode).toMatch(/^00/);
  });

  it("nursery B cannot edit or delete nursery A's variant", async () => {
    const p = await newProduct(f.A.nurseryId, 0);
    const v = await addVariant(f.A.nurseryId, p.id, { name: 'של A', stockQuantity: 2 });
    const edit = await saveVariant(prisma, { nurseryId: f.B.nurseryId, productId: p.id, variantId: v, input: input({ name: 'נפרץ', stockQuantity: 99 }) });
    expect(edit.ok).toBe(false);
    expect(await deleteVariant(prisma, { nurseryId: f.B.nurseryId, productId: p.id, variantId: v })).toEqual({ ok: false, error: 'הווריאנט לא נמצא' });
    expect(await prisma.productVariant.findUniqueOrThrow({ where: { id: v } })).toMatchObject({ name: 'של A', stockQuantity: 2 });
  });

  it('stock cannot go below reserved units', async () => {
    const p = await newProduct(f.A.nurseryId, 0);
    const v = await addVariant(f.A.nurseryId, p.id, { name: 'שמור', stockQuantity: 3 });
    await createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: v, quantity: 2 }]));
    const r = await saveVariant(prisma, { nurseryId: f.A.nurseryId, productId: p.id, variantId: v, input: input({ name: 'שמור', stockQuantity: 1 }) });
    expect(r.ok).toBe(false);
  });

  it('default cannot be deleted; ordered variant is deactivated; unused variant is deleted', async () => {
    const p = await newProduct(f.A.nurseryId, 2);
    const def = await defaultVariant(p.id);
    expect((await deleteVariant(prisma, { nurseryId: f.A.nurseryId, productId: p.id, variantId: def.id })).ok).toBe(false);

    const used = await addVariant(f.A.nurseryId, p.id, { name: 'הוזמן', stockQuantity: 2 });
    const o = await createOrderRecord(prisma, orderInput([{ productId: p.id, variantId: used, quantity: 1 }]));
    await transitionOrder(prisma, { nurseryId: f.A.nurseryId, orderId: o.orderId, to: 'CANCELLED' });
    expect(await deleteVariant(prisma, { nurseryId: f.A.nurseryId, productId: p.id, variantId: used })).toEqual({ ok: true, deleted: false, deactivated: true });

    const unused = await addVariant(f.A.nurseryId, p.id, { name: 'חדש' });
    // הוספה עם מלאי 0 לא יוצרת תנועת מלאי, ולכן אפשר למחוק
    expect(await deleteVariant(prisma, { nurseryId: f.A.nurseryId, productId: p.id, variantId: unused })).toEqual({ ok: true, deleted: true, deactivated: false });
  });

  it('with siblings, every variant needs a name', async () => {
    const p = await newProduct(f.A.nurseryId, 1);
    const def = await defaultVariant(p.id);
    await addVariant(f.A.nurseryId, p.id, { name: 'גדול' });
    const r = await saveVariant(prisma, { nurseryId: f.A.nurseryId, productId: p.id, variantId: def.id, input: input({ name: '', stockQuantity: 1 }) });
    expect(r).toMatchObject({ ok: false });
  });

  it('size × color: options are stored, the name is composed, and a duplicate combination is rejected', async () => {
    const p = await newProduct(f.A.nurseryId, 0);
    const id = await addVariant(f.A.nurseryId, p.id, { name: 'גדול', option2: 'כתום', colorHex: '#e07b39', stockQuantity: 2 });
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id } });
    expect(v).toMatchObject({ name: 'גדול / כתום', option1: 'גדול', option2: 'כתום', colorHex: '#e07b39' });
    await addVariant(f.A.nurseryId, p.id, { name: 'גדול', option2: 'בז׳' });
    const dup = await saveVariant(prisma, { nurseryId: f.A.nurseryId, productId: p.id, variantId: null, input: input({ name: 'גדול', option2: 'כתום' }) });
    expect(dup).toMatchObject({ ok: false, error: expect.stringContaining('גדול / כתום') });
    // אותו שילוב במוצר אחר — מותר
    const other = await newProduct(f.A.nurseryId, 0);
    await addVariant(f.A.nurseryId, other.id, { name: 'גדול', option2: 'כתום' });
  });
});
