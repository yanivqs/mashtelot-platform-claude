/**
 * כתובת מוצר (slug שמור / 8 תווי מזהה / פורמט ישן) והסתרת מוצר שממתין לתמונה — מול ה-DB.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { prisma } from '@/lib/prisma';
import { getFeaturedProducts, getProductByParam } from '@/lib/catalog';
import { productSlug } from '@/lib/utils';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function product(data: { title: string; slug?: string; imageRequired?: boolean; nurseryId?: string }) {
  return prisma.nurseryProduct.create({
    data: {
      nurseryId: data.nurseryId ?? f.A.nurseryId,
      customTitle: data.title,
      price: '10.00',
      stockQuantity: 3,
      slug: data.slug ?? null,
      imageRequired: data.imageRequired ?? false,
    },
  });
}

describe('product URL resolution', () => {
  it('finds by saved slug, short form and old full-id form', async () => {
    const slug = `watering-can-${randomUUID().slice(0, 6)}`;
    const p = await product({ title: 'משפך השקיה', slug });
    expect((await getProductByParam(f.A.nurseryId, slug))?.id).toBe(p.id);
    expect((await getProductByParam(f.A.nurseryId, productSlug(p.id, 'משפך השקיה')))?.id).toBe(p.id);
    expect((await getProductByParam(f.A.nurseryId, `משפך-השקיה--${p.id}`))?.id).toBe(p.id);
  });

  it('another nursery cannot resolve the product (slug or id prefix)', async () => {
    const slug = `pot-${randomUUID().slice(0, 6)}`;
    const p = await product({ title: 'עציץ', slug });
    expect(await getProductByParam(f.B.nurseryId, slug)).toBeNull();
    expect(await getProductByParam(f.B.nurseryId, productSlug(p.id, 'עציץ'))).toBeNull();
  });

  it('slug is unique per nursery but may repeat across nurseries', async () => {
    const slug = `dup-${randomUUID().slice(0, 6)}`;
    await product({ title: 'א', slug });
    await expect(product({ title: 'ב', slug })).rejects.toThrow();
    await expect(product({ title: 'ג', slug, nurseryId: f.B.nurseryId })).resolves.toBeTruthy();
  });
});

describe('image-required products are hidden from the store', () => {
  it('not resolvable and not listed until the flag clears', async () => {
    const p = await product({ title: 'פיקוס ממתין', imageRequired: true });
    expect(await getProductByParam(f.A.nurseryId, productSlug(p.id, 'פיקוס ממתין'))).toBeNull();
    expect((await getFeaturedProducts(f.A.nurseryId, 100)).some((x) => x.id === p.id)).toBe(false);

    await prisma.nurseryProduct.update({ where: { id: p.id }, data: { imageRequired: false, customImageUrl: 'https://x/img.jpg' } });
    expect((await getProductByParam(f.A.nurseryId, productSlug(p.id, 'פיקוס ממתין')))?.id).toBe(p.id);
  });
});
