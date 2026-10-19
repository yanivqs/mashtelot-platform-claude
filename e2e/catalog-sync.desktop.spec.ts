import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { ADMIN, SHOP } from '../playwright.config';
import { E2E_OWNER2, E2E_PLANT, E2E_SUPER } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

async function productPage(page: Page) {
  await page.goto(`${SHOP}/catalog?q=${encodeURIComponent(E2E_PLANT)}`);
  await page.locator('h3', { hasText: E2E_PLANT }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: E2E_PLANT })).toBeVisible();
}

test('central edit → no store change → owner approves part, keeps part, then restores it (§6)', async ({ page }) => {
  const db = new PrismaClient({ log: [] });
  const plant = await db.plant.findFirstOrThrow({ where: { hebrewName: E2E_PLANT } });
  await db.$disconnect();

  // סופר-אדמין משנה תיאור ואור
  await login(page, E2E_SUPER);
  await page.goto(`${ADMIN}/admin/catalog/${plant.id}`);
  await page.locator('textarea[name="description"]').fill('תיאור מעודכן מהקטלוג');
  await page.locator('[name="light"]').fill('חצי צל');
  await page.getByRole('button', { name: 'שמירת שינויים' }).click();
  await expect(page.getByText('1 מוצרים בחנויות יקבלו הצעת עדכון')).toBeVisible();

  // החנות לא השתנתה
  await productPage(page);
  await expect(page.getByText('תיאור מקורי')).toBeVisible();
  await expect(page.getByText('תיאור מעודכן מהקטלוג')).toHaveCount(0);

  // בעל המשתלה: מונה בתפריט + כרטיס בלוח הבקרה
  await login(page, E2E_OWNER2);
  await expect(page.getByText('עדכונים מהקטלוג המרכזי ממתינים לאישורכם')).toBeVisible();
  await page.getByRole('link', { name: 'עדכונים מהקטלוג (1)' }).click();

  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: E2E_PLANT }) });
  await expect(section.getByText('גרסה 1 ← 2')).toBeVisible();
  await expect(section.getByRole('cell', { name: 'תיאור מעודכן מהקטלוג' })).toBeVisible();
  // מאשרים את האור, משאירים את התיאור שלנו
  await section.getByLabel('לעדכן תיאור').uncheck();
  await section.getByRole('button', { name: 'אישור' }).click();
  // ההצעה יורדת מהרשימה, והתיאור עובר ל"שדות שנשמרו אצלכם"
  await expect(page.getByText('אין עדכונים ממתינים')).toBeVisible();
  await expect(page.locator('form').filter({ hasText: 'תיאור:' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'עדכונים מהקטלוג', exact: true })).toBeVisible();

  await productPage(page);
  await expect(page.getByText('תיאור מקורי')).toBeVisible();
  await expect(page.getByText('חצי צל').first()).toBeVisible();

  // החזרת התיאור לסנכרון
  await page.goto(`${ADMIN}/admin/catalog-updates`);
  const local = page.locator('form').filter({ hasText: 'תיאור:' });
  await local.getByRole('button', { name: 'החזרה לסנכרון' }).click();
  await expect(page.getByText('שדות שנשמרו אצלכם')).toHaveCount(0);

  await productPage(page);
  await expect(page.getByText('תיאור מעודכן מהקטלוג')).toBeVisible();
});
