/**
 * תיקיית התמונות של המשתלה: בידוד בין משתלות, שיוך למוצר, ומניעת מחיקה של תמונה בשימוש.
 */
import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { assignImageToProduct, deleteNurseryImage, imageUsage, listNurseryImages } from '@/lib/nursery-images';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

async function image(nurseryId: string, name: string) {
  return prisma.nurseryImage.create({
    data: { nurseryId, url: `https://img.invalid/${f.runId}/${name}`, storagePath: `nurseries/${nurseryId}/${name}`, fileName: name },
  });
}

async function product(nurseryId: string, title: string, imageRequired = false) {
  return prisma.nurseryProduct.create({ data: { nurseryId, customTitle: title, price: '10.00', imageRequired } });
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
});

describe('nursery image folder', () => {
  it('lists only the images of the requested nursery', async () => {
    const a = await image(f.A.nurseryId, 'a-list.jpg');
    const b = await image(f.B.nurseryId, 'b-list.jpg');
    const ids = (await listNurseryImages(f.A.nurseryId)).images.map((i) => i.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  it('assigns an image to a product and releases the image-required hold', async () => {
    const img = await image(f.A.nurseryId, 'a-assign.jpg');
    const p = await product(f.A.nurseryId, 'ממתין', true);
    expect(await assignImageToProduct(f.A.nurseryId, img.id, p.id, 'owner@test.invalid')).toEqual({});
    const after = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.customImageUrl).toBe(img.url);
    expect(after.imageRequired).toBe(false);
  });

  it('refuses to cross nurseries, for the image and for the product', async () => {
    const mine = await image(f.A.nurseryId, 'a-cross.jpg');
    const foreign = await image(f.B.nurseryId, 'b-cross.jpg');
    const myProduct = await product(f.A.nurseryId, 'שלי');
    const foreignProduct = await product(f.B.nurseryId, 'זר');

    expect((await assignImageToProduct(f.A.nurseryId, foreign.id, myProduct.id, 'x@test.invalid')).error).toBeTruthy();
    expect((await assignImageToProduct(f.A.nurseryId, mine.id, foreignProduct.id, 'x@test.invalid')).error).toBeTruthy();
    expect((await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: foreignProduct.id } })).customImageUrl).toBeNull();

    expect((await deleteNurseryImage(f.A.nurseryId, foreign.id, 'x@test.invalid')).error).toBeTruthy();
    expect(await prisma.nurseryImage.findUnique({ where: { id: foreign.id } })).not.toBeNull();
  });

  it('counts usage per nursery, from the main image and from variants, once per product', async () => {
    const img = await image(f.A.nurseryId, 'a-usage.jpg');
    const main = await product(f.A.nurseryId, 'ראשית');
    await assignImageToProduct(f.A.nurseryId, img.id, main.id, 'x@test.invalid');
    const withVariant = await product(f.A.nurseryId, 'וריאנט');
    await prisma.productVariant.create({
      data: { nurseryId: f.A.nurseryId, nurseryProductId: withVariant.id, name: 'גדול', price: '12.00', imageUrls: [img.url] },
    });
    await prisma.productVariant.create({
      data: { nurseryId: f.A.nurseryId, nurseryProductId: main.id, name: 'קטן', price: '11.00', imageUrls: [img.url] },
    });

    const used = (await imageUsage(f.A.nurseryId, [img.url])).get(img.url) ?? [];
    expect(used.map((u) => u.id).sort()).toEqual([main.id, withVariant.id].sort());
    expect((await imageUsage(f.B.nurseryId, [img.url])).get(img.url)).toBeUndefined();
  });

  it('does not delete an image in use, and deletes it once free', async () => {
    const img = await image(f.A.nurseryId, 'a-delete.jpg');
    const p = await product(f.A.nurseryId, 'משתמש');
    await assignImageToProduct(f.A.nurseryId, img.id, p.id, 'x@test.invalid');

    expect((await deleteNurseryImage(f.A.nurseryId, img.id, 'x@test.invalid')).error).toMatch(/משויכת/);
    expect(await prisma.nurseryImage.findUnique({ where: { id: img.id } })).not.toBeNull();

    await prisma.nurseryProduct.update({ where: { id: p.id }, data: { customImageUrl: null } });
    expect(await deleteNurseryImage(f.A.nurseryId, img.id, 'x@test.invalid')).toEqual({});
    expect(await prisma.nurseryImage.findUnique({ where: { id: img.id } })).toBeNull();
  });
});
