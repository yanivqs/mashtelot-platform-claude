import type { Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_FOLDER_OWNER, FIX_SHOP } from './global-setup';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function uploadToGallery(page: Page, name: string) {
  const gallery = page.locator('div', { has: page.getByText(/^תמונות נוספות/) }).last();
  const chooser = page.waitForEvent('filechooser');
  await gallery.getByRole('button', { name: 'העלאת תמונה' }).click();
  await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: PNG });
}

test('owner adds, reorders and removes extra product images; the store shows them as a gallery', async ({ page }) => {
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  const product = await db.nurseryProduct.create({
    data: { nurseryId: fix.id, customTitle: 'פיקוס גלריה', customImageUrl: 'https://images.unsplash.com/photo-main', price: '30.00', stockQuantity: 4 },
  });

  try {
    await page.goto(`${ADMIN}/admin/login`);
    await page.locator('input[name="email"]').fill(E2E_FOLDER_OWNER.email);
    await page.locator('input[name="password"]').fill(E2E_FOLDER_OWNER.password);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(`${ADMIN}/admin`);

    await page.goto(`${ADMIN}/admin/products/${product.id}`);
    await expect(page.getByText('תמונות נוספות (0/8)')).toBeVisible();
    await uploadToGallery(page, 'g1.png');
    await expect(page.getByText('תמונות נוספות (1/8)')).toBeVisible();
    await uploadToGallery(page, 'g2.png');
    await expect(page.getByText('תמונות נוספות (2/8)')).toBeVisible();
    await page.getByRole('button', { name: 'שמירה' }).first().click();
    await expect(page.getByText(/נשמר/).first()).toBeVisible();

    const saved = (await db.nurseryProduct.findUniqueOrThrow({ where: { id: product.id } })).galleryImageUrls;
    expect(saved).toHaveLength(2);

    // החנות: תמונה ראשית ואחריה שתי התמונות הנוספות
    await page.goto(`${FIX_SHOP}/product/${product.id}`);
    await expect(page.getByRole('button', { name: /^תמונה \d$/ })).toHaveCount(3);

    // שינוי סדר והסרה נשמרים
    await page.goto(`${ADMIN}/admin/products/${product.id}`);
    await page.getByRole('button', { name: 'הזזת תמונה 2 קדימה' }).click();
    await page.getByRole('button', { name: 'שמירה' }).first().click();
    await expect(page.getByText(/נשמר/).first()).toBeVisible();
    expect((await db.nurseryProduct.findUniqueOrThrow({ where: { id: product.id } })).galleryImageUrls).toEqual([saved[1], saved[0]]);

    await page.reload();
    await page.getByRole('button', { name: 'הסרת תמונה 1' }).click();
    await page.getByRole('button', { name: 'שמירה' }).first().click();
    await expect(page.getByText(/נשמר/).first()).toBeVisible();
    expect((await db.nurseryProduct.findUniqueOrThrow({ where: { id: product.id } })).galleryImageUrls).toEqual([saved[0]]);
  } finally {
    // owner-fixes סופר את מוצרי המשתלה הזו
    await db.nurseryProduct.delete({ where: { id: product.id } });
    await db.$disconnect();
  }
});
