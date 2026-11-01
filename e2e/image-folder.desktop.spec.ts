import type { Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_FOLDER_OWNER, E2E_SUPER7, FIX_SHOP } from './global-setup';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const file = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

test.describe.configure({ mode: 'serial' });

test('platform admin uploads to the nursery folder but cannot assign', async ({ page }) => {
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  await db.$disconnect();

  await login(page, E2E_SUPER7);
  await page.goto(`${ADMIN}/admin/nurseries/${fix.id}`);
  await page.getByRole('link', { name: 'תיקיית התמונות של המשתלה' }).click();
  await page.getByLabel('בחירת תמונות להעלאה').setInputFiles([file('from-admin.png')]);
  await expect(page.getByText('from-admin.png')).toBeVisible();
  await expect(page.getByText('לא משויכת')).toBeVisible();
  await expect(page.getByRole('button', { name: /שיוך/ })).toHaveCount(0);
});

test('owner uploads several images, assigns from the folder and picks in the product editor', async ({ page }) => {
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  const waiting = await db.nurseryProduct.create({
    data: { nurseryId: fix.id, customTitle: 'סחלב ממתין', price: '20.00', stockQuantity: 5, imageRequired: true },
  });
  await db.$disconnect();

  await login(page, E2E_FOLDER_OWNER);
  await page.getByRole('link', { name: 'תיקיית תמונות' }).first().click();
  await expect(page.getByText('from-admin.png')).toBeVisible();

  await page.getByLabel('בחירת תמונות להעלאה').setInputFiles([file('one.png'), file('two.png')]);
  await expect(page.getByText('one.png')).toBeVisible();
  await expect(page.getByText('two.png')).toBeVisible();

  // המוצר מוסתר עד לשיוך, ואחריו מוצג בחנות
  await page.goto(`${FIX_SHOP}/catalog`);
  await expect(page.getByText('סחלב ממתין')).toHaveCount(0);

  await page.goto(`${ADMIN}/admin/products/images?show=unassigned`);
  await page.getByRole('button', { name: 'שיוך one.png למוצר' }).click();
  await page.getByLabel('חיפוש מוצר לשיוך').fill('סחלב');
  await page.getByRole('button', { name: /סחלב ממתין/ }).click();
  await expect(page.getByText('one.png')).toHaveCount(0);

  await page.goto(`${ADMIN}/admin/products/images`);
  await expect(page.getByRole('link', { name: 'סחלב ממתין' })).toBeVisible();
  await page.goto(`${FIX_SHOP}/catalog`);
  await expect(page.getByText('סחלב ממתין').first()).toBeVisible();

  // תמונה בשימוש לא נמחקת; תמונה פנויה נמחקת
  await page.goto(`${ADMIN}/admin/products/images`);
  page.on('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'מחיקת one.png' }).click();
  await expect(page.getByText(/התמונה משויכת למוצרים/)).toBeVisible();
  await page.getByRole('button', { name: 'מחיקת from-admin.png' }).click();
  await expect(page.getByText('from-admin.png')).toHaveCount(0);

  // בחירה מהתיקייה בעריכת מוצר: נכנסת בשמירה, ומחליפה את התמונה הקודמת
  await page.goto(`${ADMIN}/admin/products/${waiting.id}`);
  await page.getByRole('button', { name: 'בחירה מתיקיית התמונות' }).first().click();
  await page.getByRole('button', { name: 'בחירת two.png' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'שמירה' }).first().click();
  await expect(page.getByText(/נשמר/).first()).toBeVisible();
  await page.goto(`${ADMIN}/admin/products/images?show=unassigned`);
  await expect(page.getByText('one.png')).toBeVisible();
  await expect(page.getByText('two.png')).toHaveCount(0);

  // ניקוי: owner-fixes סופר את מוצרי המשתלה הזו
  const cleanup = new PrismaClient();
  await cleanup.nurseryProduct.delete({ where: { id: waiting.id } });
  await cleanup.$disconnect();
});
