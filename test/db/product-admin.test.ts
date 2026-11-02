/**
 * מחיקה ושכפול של מוצר: מוצר שהוזמן נשמר בשביל ההיסטוריה ומשחרר את הקטלוג, ושכפול יוצר מוצר עצמאי.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { duplicateProduct, removeProduct } from '@/lib/product-admin';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
let plantId: string;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  plantId = (await prisma.plant.create({ data: { hebrewName: `צמח בדיקה ${Date.now()}`, description: 'תיאור מהקטלוג', imageUrl: 'https://img.invalid/p.jpg' } })).id;
});

afterAll(async () => {
  const ids = { in: [f.A.nurseryId, f.B.nurseryId] };
  await prisma.order.deleteMany({ where: { nurseryId: ids } });
  await prisma.nurseryProduct.deleteMany({ where: { nurseryId: ids } });
  await prisma.plant.delete({ where: { id: plantId } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const ordered = async (nurseryProductId: string) =>
  prisma.order.create({
    data: {
      nurseryId: f.A.nurseryId,
      customerName: 'א',
      customerPhone: '050',
      customerEmail: 'a@e2e.invalid',
      totalAmount: '10.00',
      items: { create: { nurseryProductId, productTitle: 'שם בזמן ההזמנה', quantity: 1, unitPrice: '10.00' } },
    },
  });

describe('removeProduct', () => {
  it('a product without orders is deleted; another nursery cannot touch it', async () => {
    const p = await prisma.nurseryProduct.create({ data: { nurseryId: f.A.nurseryId, customTitle: 'בלי הזמנות', price: '5.00' } });
    expect((await removeProduct(prisma, f.B.nurseryId, p.id)).ok).toBe(false);
    expect(await removeProduct(prisma, f.A.nurseryId, p.id)).toMatchObject({ ok: true, mode: 'deleted' });
    expect(await prisma.nurseryProduct.count({ where: { id: p.id } })).toBe(0);
  });

  it('an ordered catalog product is archived: order intact, hidden, and the plant can be assigned again', async () => {
    const p = await prisma.nurseryProduct.create({ data: { nurseryId: f.A.nurseryId, plantId, price: '10.00', slug: 'zemach', stockQuantity: 2 } });
    const order = await ordered(p.id);
    expect(await removeProduct(prisma, f.A.nurseryId, p.id)).toMatchObject({ ok: true, mode: 'archived' });

    const row = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row).toMatchObject({ isActive: false, plantId: null, slug: null });
    expect(row.customTitle).toContain('צמח בדיקה');
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    expect(items[0]).toMatchObject({ nurseryProductId: p.id, productTitle: 'שם בזמן ההזמנה' });

    const again = await prisma.nurseryProduct.create({ data: { nurseryId: f.A.nurseryId, plantId, price: '12.00', slug: 'zemach' } });
    expect(again.id).not.toBe(p.id);
    expect((await removeProduct(prisma, f.A.nurseryId, p.id)).ok).toBe(false);
    await prisma.nurseryProduct.delete({ where: { id: again.id } });
  });
});

describe('duplicateProduct', () => {
  it('a catalog product becomes an independent hidden product with its content, categories and variants; no stock or SKU', async () => {
    const cat = await prisma.nurseryCategory.create({ data: { nurseryId: f.A.nurseryId, name: 'קטגוריה', slug: `cat-${Date.now()}` } });
    const p = await prisma.nurseryProduct.create({
      data: {
        nurseryId: f.A.nurseryId,
        plantId,
        price: '20.00',
        slug: 'mekor',
        optionLabel: 'גודל',
        categories: { create: { nurseryCategoryId: cat.id } },
      },
    });
    await prisma.productVariant.updateMany({ where: { nurseryProductId: p.id, isDefault: true }, data: { name: 'קטן', option1: 'קטן', sku: `SKU-${Date.now()}`, barcode: `${Date.now()}`, stockQuantity: 4 } });
    await prisma.productVariant.create({ data: { nurseryId: f.A.nurseryId, nurseryProductId: p.id, name: 'גדול', option1: 'גדול', stockQuantity: 5, sortOrder: 1 } });
    const r = await duplicateProduct(prisma, f.A.nurseryId, p.id);
    if (!r.ok) throw new Error('duplicate failed');
    const copy = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: r.id }, include: { categories: true, variants: true } });
    expect(copy).toMatchObject({ plantId: null, isActive: false, stockQuantity: 0, slug: null, optionLabel: 'גודל', customDescription: 'תיאור מהקטלוג', customImageUrl: 'https://img.invalid/p.jpg' });
    expect(copy.customTitle).toMatch(/\(עותק\)$/);
    expect(Number(copy.price)).toBe(20);
    expect(copy.categories.map((c) => c.nurseryCategoryId)).toEqual([cat.id]);
    const variants = [...copy.variants].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({ name: 'קטן', isDefault: true, stockQuantity: 0, sku: null, barcode: null });
    expect(variants[1]).toMatchObject({ name: 'גדול', isDefault: false, stockQuantity: 0 });
    expect((await duplicateProduct(prisma, f.B.nurseryId, p.id)).ok).toBe(false);
    await prisma.nurseryCategory.delete({ where: { id: cat.id } });
  });
});
