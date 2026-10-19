import { expect, test } from '@playwright/test';
import { ADMIN, SHOP } from '../playwright.config';
import { E2E_SUPER } from './global-setup';

const results = (page: import('@playwright/test').Page) => page.locator('main');

test('smart search: typo, plural/prefix, and seeded synonym (R04-03)', async ({ page }) => {
  await page.goto(`${SHOP}/catalog?q=${encodeURIComponent('לבדנר')}`);
  await expect(results(page).getByText('לבנדר רפואי')).toBeVisible();

  await page.goto(`${SHOP}/catalog?q=${encodeURIComponent('הורדים')}`);
  await expect(results(page).getByText('ורד אדום')).toBeVisible();
  await expect(results(page).getByText('זית סורי')).toHaveCount(0);

  // "ריחן ↔ בזיליקום" מגיע מהרשימה ההתחלתית שבמיגרציה
  await page.goto(`${SHOP}/catalog?q=${encodeURIComponent('בזיליקום')}`);
  await expect(results(page).getByText('ריחן מתוק')).toBeVisible();
});

test('super admin adds a synonym group and the storefront uses it', async ({ page }) => {
  await page.goto(`${SHOP}/catalog?q=${encodeURIComponent('אוליבה')}`);
  await expect(results(page).getByText('זית סורי')).toHaveCount(0);

  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_SUPER.email);
  await page.locator('input[name="password"]').fill(E2E_SUPER.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  await page.getByRole('link', { name: 'מילים נרדפות בחיפוש' }).click();
  const input = page.getByLabel('מונחים נרדפים, מופרדים בפסיק');

  // שגיאה: מונח אחד — ההודעה מוצגת והקלט נשמר
  await input.fill('אוליבה');
  await page.getByRole('button', { name: 'הוספת קבוצה' }).click();
  await expect(page.getByText('יש להזין לפחות שני מונחים')).toBeVisible();
  await expect(input).toHaveValue('אוליבה');

  await input.fill('זית, אוליבה');
  await page.getByRole('button', { name: 'הוספת קבוצה' }).click();
  await expect(page.getByText('נוסף ✓')).toBeVisible();
  await expect(input).toHaveValue('');

  await page.goto(`${SHOP}/catalog?q=${encodeURIComponent('אוליבה')}`);
  await expect(results(page).getByText('זית סורי')).toBeVisible();
});

test('synonyms screen is super-admin only', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/search-synonyms`);
  await expect(page).toHaveURL(/\/admin\/login/);
});
