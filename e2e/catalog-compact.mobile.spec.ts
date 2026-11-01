import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { FIX_SHOP } from './global-setup';

test('mobile catalog: categories stay on one scrollable row and only existing letters show', async ({ page }) => {
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  const product = await db.nurseryProduct.create({
    data: { nurseryId: fix.id, customTitle: 'ןןן אות סופית', price: '10.00', stockQuantity: 3 },
  });
  const names = Array.from({ length: 10 }, (_, i) => `קטגוריה ארוכה ${i + 1}`);
  const created = await Promise.all(
    names.map((name, i) =>
      db.nurseryCategory.create({
        data: { nurseryId: fix.id, name, slug: `compact-${i}`, sortOrder: 100 + i, products: { create: { nurseryProductId: product.id } } },
      }),
    ),
  );

  try {
    await page.goto(`${FIX_SHOP}/catalog?category=compact-9`);
    const active = page.locator('a[aria-current="true"]', { hasText: 'קטגוריה ארוכה 10' });
    await expect(active).toBeVisible();

    const row = active.locator('..');
    const box = await row.boundingBox();
    expect(box!.height).toBeLessThan(60);
    expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    // הקטגוריה שנבחרה נגללת אל תוך המסך, והעמוד עצמו לא נמתח לרוחב
    await expect(active).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto(`${FIX_SHOP}/catalog`);
    const bar = page.getByRole('navigation', { name: 'סינון לפי אות' });
    await expect(bar.getByRole('link', { name: 'נ', exact: true })).toBeVisible();
    await expect(bar.getByText('ת', { exact: true })).toHaveCount(0);
  } finally {
    await db.nurseryCategory.deleteMany({ where: { id: { in: created.map((c) => c.id) } } });
    await db.nurseryProduct.delete({ where: { id: product.id } });
    await db.$disconnect();
  }
});
