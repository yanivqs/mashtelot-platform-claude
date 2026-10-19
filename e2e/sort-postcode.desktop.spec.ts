import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { ADMIN, SHOP } from '../playwright.config';
import { E2E_OWNER3 } from './global-setup';

test('catalog sort (R04-07): price both ways and name; sorted pages are noindex', async ({ page }) => {
  await page.goto(`${SHOP}/catalog`);
  const titles = page.locator('a > h3');
  await page.getByLabel('מיון').selectOption('price_asc');
  await expect(page).toHaveURL(/sort=price_asc/);
  await expect(titles.first()).toHaveText('ריחן מתוק');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  await page.getByLabel('מיון').selectOption('price_desc');
  await expect(page).toHaveURL(/sort=price_desc/);
  await expect(titles.first()).toHaveText('זית סורי');

  // המיון נשמר בחיפוש
  await page.getByLabel('מיון').selectOption('name');
  await expect(page).toHaveURL(/sort=name/);
  await expect(page.getByLabel('מיון')).toHaveValue('name');

  await page.getByLabel('מיון').selectOption('recommended');
  await expect(page).not.toHaveURL(/sort=/);
});

test('shipping by postcode (§11.01): owner defines a postcode zone; checkout prices and stores it', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER3.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER3.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  await page.goto(`${ADMIN}/admin/shipping`);
  await page.getByLabel('שם האזור').fill('רמת גן מיקוד E2E');
  await page.getByLabel('מחיר משלוח (₪)').fill('25');
  await page.getByLabel('מיקודים לאזור חדש').fill('12345678');
  await page.getByRole('button', { name: 'הוספת אזור משלוח' }).click();
  await expect(page.getByText(/מיקוד לא תקין/)).toBeVisible();
  // UX-01: הערכים נשמרים אחרי שגיאה
  await expect(page.getByLabel('שם האזור')).toHaveValue('רמת גן מיקוד E2E');
  await page.getByLabel('מיקודים לאזור חדש').fill('5250');
  await page.getByRole('button', { name: 'הוספת אזור משלוח' }).click();
  await expect(page.getByText('נוסף ✓')).toBeVisible();
  await expect(page.getByLabel('מיקודים — רמת גן מיקוד E2E')).toHaveValue('5250');

  // קונה: משלוח עם מיקוד שתואם
  await page.goto(`${SHOP}/catalog`);
  await page.locator('article, li, div').filter({ hasText: 'ריחן מתוק' }).getByRole('button', { name: 'הוסף לעגלה' }).first().click();
  await expect(page.locator('header').getByRole('link', { name: /עגלת קניות, 1 פריטים/ }).first()).toBeVisible();
  await page.goto(`${SHOP}/checkout`);
  await page.locator('input[name="customerName"]').fill('קונה מיקוד');
  await page.locator('input[name="customerPhone"]').fill('050-1111111');
  const email = `postcode-${Date.now()}@e2e.invalid`;
  await page.locator('input[name="customerEmail"]').fill(email);
  await page.locator('label', { hasText: 'משלוח עד הבית' }).click();
  await expect(page.getByText('הזינו מיקוד או עיר')).toBeVisible();
  await page.getByLabel(/^עיר \/ יישוב/).fill('רמת גן');
  await page.locator('input[name="shippingAddress"]').fill('ביאליק 1');
  await page.getByLabel(/^מיקוד/).fill('52500-01');
  // סיכום ההזמנה: שורת המשלוח מציגה את מחיר האזור שנבחר לפי המיקוד
  await expect(page.getByText('משלוח', { exact: true }).locator('..')).toContainText('25');
  await page.getByLabel('תשלום לשליח').check();
  await page.getByRole('button', { name: /שליחת ההזמנה|סיום|הזמנה/ }).click();
  await expect(page).toHaveURL(/\/checkout\/success\//);

  const db = new PrismaClient({ log: [] });
  try {
    const order = await db.order.findFirstOrThrow({ where: { customerEmail: email } });
    expect(order.shippingPostcode).toBe('5250001');
    expect(order.shippingAddress).toBe('ביאליק 1, רמת גן 5250001');
    expect(Number(order.shippingCost)).toBe(25);
  } finally {
    await db.$disconnect();
  }
});
