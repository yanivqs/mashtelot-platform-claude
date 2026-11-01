import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_FOLDER_OWNER, FIX_SHOP } from './global-setup';

test('owner changes product status from the main products list; the store follows', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_FOLDER_OWNER.email);
  await page.locator('input[name="password"]').fill(E2E_FOLDER_OWNER.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  await page.goto(`${ADMIN}/admin/products`);
  await page.getByRole('button', { name: 'הסתרת בזיליקום' }).click();
  await expect(page.getByRole('button', { name: 'הצגת בזיליקום' })).toBeVisible();
  await page.goto(`${FIX_SHOP}/catalog`);
  await expect(page.getByText('בזיליקום')).toHaveCount(0);

  await page.goto(`${ADMIN}/admin/products`);
  await page.getByRole('button', { name: 'הצגת בזיליקום' }).click();
  await expect(page.getByRole('button', { name: 'הסתרת בזיליקום' })).toBeVisible();
  await page.goto(`${FIX_SHOP}/catalog`);
  await expect(page.getByText('בזיליקום').first()).toBeVisible();

  // קישור לערוץ: הקלדה בשורה ריקה מסמנת אותה, והקישור עולה לחנות; בלי סימון — אזהרה
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  await db.nurseryModule.upsert({
    where: { nurseryId_moduleKey: { nurseryId: fix.id, moduleKey: 'social' } },
    create: { nurseryId: fix.id, moduleKey: 'social', isEnabled: true },
    update: { isEnabled: true },
  });
  await db.$disconnect();
  await page.goto(`${ADMIN}/admin/settings`);
  const url = 'https://wolt.com/he/isr/venue/e2e-shop';
  const row = page.getByRole('textbox', { name: /קישור.*Wolt/ });
  await row.fill(url);
  const box = page.getByRole('checkbox', { name: /Wolt|וולט/ });
  await expect(box).toBeChecked();
  await box.uncheck();
  await expect(page.getByText('הקישור שמור אבל לא מוצג באתר')).toBeVisible();
  await box.check();
  await page.getByRole('button', { name: 'שמירת ערוצים' }).click();
  await expect(page.getByText('נשמר ✓').first()).toBeVisible();
  await page.goto(`${FIX_SHOP}/`);
  await expect(page.getByRole('contentinfo').locator(`a[href="${url}"]`)).toBeVisible();
});

test('store share tags: og:image from the logo, and the catalog does not claim the home url', async ({ page }) => {
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  await db.nursery.update({ where: { id: fix.id }, data: { logoUrl: 'https://img.invalid/logo.png' } });
  try {
    await page.goto(`${FIX_SHOP}/`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://img.invalid/logo.png');
    await page.goto(`${FIX_SHOP}/catalog`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://img.invalid/logo.png');
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  } finally {
    await db.nursery.update({ where: { id: fix.id }, data: { logoUrl: fix.logoUrl } });
    await db.$disconnect();
  }
});
