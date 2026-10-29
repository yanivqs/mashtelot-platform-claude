/**
 * בלוק מוצרים "מגוון": מוצרים מקטגוריות ראשיות שונות לסירוגין, ושם הקטגוריה לכרטיס —
 * רק מנתוני המשתלה עצמה.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// lib/catalog מייבא קוד server-only; בבדיקה רצים ישירות מול ה-DB
vi.mock('server-only', () => ({}));
import { prisma } from '@/lib/prisma';
import { getBlockProducts, getProductCategoryLabels } from '@/lib/catalog';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const run = randomUUID().slice(0, 6);

async function category(nurseryId: string, name: string, parentId: string | null, sortOrder = 0) {
  return prisma.nurseryCategory.create({ data: { nurseryId, name, slug: `${name}-${run}-${randomUUID().slice(0, 4)}`, parentId, sortOrder } });
}

async function product(nurseryId: string, title: string, categoryIds: string[], createdAt: Date) {
  return prisma.nurseryProduct.create({
    data: {
      nurseryId,
      customTitle: title,
      price: '10.00',
      stockQuantity: 5,
      createdAt,
      categories: { create: categoryIds.map((nurseryCategoryId) => ({ nurseryCategoryId })) },
    },
  });
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('mixed products block', () => {
  it('alternates between root categories (including subcategories) and labels the most specific category', async () => {
    const A = f.A.nurseryId;
    const plants = await category(A, 'צמחים', null, 1);
    const indoor = await category(A, 'צמחי בית', plants.id);
    const flowers = await category(A, 'פרחים', null, 2);
    const t = (m: number) => new Date(Date.UTC(2030, 0, 1, 0, m));
    const p1 = await product(A, `מונסטרה ${run}`, [plants.id, indoor.id], t(5));
    const p2 = await product(A, `פיקוס ${run}`, [plants.id], t(4));
    const f1 = await product(A, `פטוניה ${run}`, [flowers.id], t(3));

    const items = await getBlockProducts(A, { source: 'mixed', productIds: [], categoryId: '', limit: 3 });
    expect(items.map((p) => p.id)).toEqual([p1.id, f1.id, p2.id]);

    const labels = await getProductCategoryLabels(A, [p1.id, f1.id]);
    expect(labels).toEqual({ [p1.id]: 'צמחי בית', [f1.id]: 'פרחים' });
  });

  it("tenant isolation: B's mixed block and labels never include A's products or categories", async () => {
    const items = await getBlockProducts(f.B.nurseryId, { source: 'mixed', productIds: [], categoryId: '', limit: 24 });
    expect(items.every((p) => p.nurseryId === f.B.nurseryId)).toBe(true);
    const aProduct = await prisma.nurseryProduct.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId, customTitle: { contains: run } } });
    expect(await getProductCategoryLabels(f.B.nurseryId, [aProduct.id])).toEqual({});
  });
});
