import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resolveTestDatabase } from './env';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('test database isolation (E01)', () => {
  it('Prisma Client is connected to the verified test database, not production', async () => {
    const db = resolveTestDatabase();
    expect(process.env.DATABASE_URL).toBe(db.url);
    const [{ current_database }] = await prisma.$queryRaw<Array<{ current_database: string }>>`
      SELECT current_database()`;
    if (db.label.startsWith('local:')) expect(current_database).toBe(db.label.slice('local:'.length));
  });

  it('creates three synthetic tenants: A and B active, C suspended', async () => {
    const rows = await prisma.nursery.findMany({
      where: { id: { in: [f.A.nurseryId, f.B.nurseryId, f.C.nurseryId] } },
      select: { id: true, isActive: true },
    });
    const active = new Map(rows.map((r) => [r.id, r.isActive]));
    expect(active.get(f.A.nurseryId)).toBe(true);
    expect(active.get(f.B.nurseryId)).toBe(true);
    expect(active.get(f.C.nurseryId)).toBe(false);
  });

  it('every tenant owns exactly its own page, product, coupon and order', async () => {
    for (const t of [f.A, f.B, f.C]) {
      const [pages, products, coupons, orders] = await Promise.all([
        prisma.staticPage.findMany({ where: { nurseryId: t.nurseryId }, select: { id: true } }),
        prisma.nurseryProduct.findMany({ where: { nurseryId: t.nurseryId }, select: { id: true } }),
        prisma.coupon.findMany({ where: { nurseryId: t.nurseryId }, select: { id: true } }),
        prisma.order.findMany({ where: { nurseryId: t.nurseryId }, select: { id: true } }),
      ]);
      expect(pages.map((x) => x.id)).toEqual([t.pageId]);
      expect(products.map((x) => x.id)).toEqual([t.productId]);
      expect(coupons.map((x) => x.id)).toEqual([t.couponId]);
      expect(orders.map((x) => x.id)).toEqual([t.orderId]);
    }
  });
});
