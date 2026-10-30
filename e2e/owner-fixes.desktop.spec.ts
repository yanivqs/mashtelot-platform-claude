import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_FIX_OWNER, FIX_SHOP } from './global-setup';

async function login(page: Page) {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_FIX_OWNER.email);
  await page.locator('input[name="password"]').fill(E2E_FIX_OWNER.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

test.describe.configure({ mode: 'serial' });

test('store footer: repaired opening hours, Waze link, builder credit; header search on desktop', async ({ page }) => {
  await page.goto(`${FIX_SHOP}/`);
  const footer = page.getByRole('contentinfo');
  // נשמר שבור ע"י הפענוח הישן ("…| 09" + "00-17:00") — מוצג מתוקן
  await expect(footer.getByText('ראשון - חמישי', { exact: true })).toBeVisible();
  await expect(footer.getByText('09:00-17:00', { exact: true })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'ניווט ב-Waze' })).toHaveAttribute('href', /waze\.com\/ul\?q=.*navigate=yes/);
  await expect(footer.getByRole('link', { name: 'פתרונות איכות' })).toHaveAttribute('href', 'https://yanivsharabi.com/ai-solutions');

  await page.getByRole('banner').getByRole('button', { name: 'חיפוש באתר' }).click();
  const box = page.getByRole('banner').getByRole('searchbox', { name: 'חיפוש באתר' });
  await expect(box).toBeFocused();
  await box.fill('בזיליקום');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/catalog\?q=%D7%91/);
  await expect(page.getByText('בזיליקום').first()).toBeVisible();
});

test('owner edits opening hours in rows; the store shows them', async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN}/admin/settings`);
  await expect(page.getByLabel('ימים 1')).toHaveValue('ראשון - חמישי');
  await expect(page.getByLabel('שעות 1')).toHaveValue('09:00-17:00');
  await page.getByRole('button', { name: 'הוספת שורה' }).click();
  await page.getByLabel('ימים 2').fill('שישי');
  await page.getByLabel('שעות 2').fill('08:00-13:00');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page.getByText(/נשמר/).first()).toBeVisible();

  await page.goto(`${FIX_SHOP}/contact`);
  await expect(page.getByRole('main').getByText('08:00-13:00')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'ניווט ב-Waze' })).toBeVisible();
});

test('inventory: filter by parent category includes subcategories; sort by price toggles', async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN}/admin/products`);
  await page.getByLabel('סינון לפי קטגוריה').selectOption({ label: 'צמחים' });
  await page.getByRole('button', { name: 'חיפוש' }).click();
  await expect(page.getByText('מוצגים 1 מתוך 3')).toBeVisible();
  await expect(page.getByText('בזיליקום')).toBeVisible();

  await page.goto(`${ADMIN}/admin/products?category=none`);
  await expect(page.getByText('מוצגים 2 מתוך 3')).toBeVisible();

  await page.goto(`${ADMIN}/admin/products`);
  const titles = page.locator('p.truncate.text-sm.font-medium');
  await page.getByRole('link', { name: 'מיון לפי מחיר' }).click();
  await expect(page).toHaveURL(/sort=price&dir=asc/);
  await expect(titles.first()).toHaveText('בזיליקום');
  await page.getByRole('link', { name: 'מיון לפי מחיר' }).click();
  await expect(page).toHaveURL(/sort=price&dir=desc/);
  await expect(titles.first()).toHaveText('פיקוס כינורי');
  await page.getByRole('link', { name: 'מיון לפי סטטוס' }).click();
  await expect(titles.first()).toHaveText('מלכודת זבובים');
});

test('categories: rename and change slug; search products to add', async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN}/admin/products/categories`);
  await page.getByRole('link', { name: 'תבלינים' }).click();
  await page.getByLabel('חיפוש מוצר להוספה').fill('פיקוס');
  await expect(page.getByText('1 מתוך 2')).toBeVisible();
  await page.getByRole('button', { name: 'הוספה' }).click();
  await expect(page.getByText('2 מוצרים ·')).toBeVisible();

  await page.locator('input[name="name"]').fill('צמחי תבלין');
  await page.locator('input[name="slug"]').fill('herbs');
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect(page.getByRole('heading', { name: 'צמחי תבלין' })).toBeVisible();

  await page.goto(`${FIX_SHOP}/catalog?category=herbs`);
  await expect(page.getByRole('heading', { name: 'צמחי תבלין' })).toBeVisible();
});

test('orders: product links to the store, internal note, permanent delete', async ({ page }) => {
  await login(page);
  await page.goto(`${ADMIN}/admin/orders`);
  await expect(page.getByRole('link', { name: 'בזיליקום' })).toHaveAttribute('href', /^http:\/\/e2efix\.localhost:3100\/product\/.+--/);

  await page.getByRole('button', { name: '+ הוספת הערה' }).click();
  await page.getByLabel('הערה פנימית (לא נשלחת ללקוח)').fill('להתקשר לפני איסוף');
  await page.getByRole('button', { name: 'שמירת הערה' }).click();
  await expect(page.getByText('נשמר')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('הערה פנימית (לא נשלחת ללקוח)')).toHaveValue('להתקשר לפני איסוף');

  await page.getByRole('button', { name: 'מחיקת הזמנה' }).click();
  await page.getByRole('button', { name: 'כן, למחוק' }).click();
  await expect(page.getByText('אין הזמנות עדיין.')).toBeVisible();
});
