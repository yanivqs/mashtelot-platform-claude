import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER3, E2E_SAVED_TEMPLATE } from './global-setup';

test('phone: calculator with a price bar, and a readable job card without sideways scroll', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER3.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER3.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  const noSidewaysScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  await page.goto(`${ADMIN}/admin/print-shop`);
  await page.getByRole('link', { name: new RegExp(E2E_SAVED_TEMPLATE) }).click();
  await page.getByLabel('טקסט').fill('בדיקת נייד עם שם עבודה ארוך');
  await page.getByRole('group', { name: 'גודל' }).getByRole('button', { name: /קטן/ }).click();
  await page.getByLabel('כמות').fill('10');
  await page.getByLabel('העלאת קובץ').setInputFiles({ name: 'mobile.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n% mobile\n') });
  await expect(page.getByTestId('print-file')).toBeVisible();
  expect(await noSidewaysScroll()).toBe(true);

  const bar = page.getByRole('link', { name: /לסיכום ושליחה/ });
  await expect(bar).toBeInViewport();
  await expect(bar).toContainText('20');

  await page.getByRole('button', { name: 'קבלת מחיר והזמנה' }).click();
  await expect(page.getByTestId('print-confirmation')).toBeVisible();

  await page.getByRole('link', { name: 'לעבודות שלי' }).click();
  const job = page.getByTestId('job-card').filter({ hasText: 'בדיקת נייד' });
  await expect(job).toBeVisible();
  expect(await noSidewaysScroll()).toBe(true);
  // שם העבודה נשאר קריא: לא נדחס לעמודה צרה של אות בשורה
  const name = (await job.getByRole('heading', { level: 2 }).boundingBox())!;
  expect(name.width).toBeGreaterThan(120);
  await expect(job.getByRole('button', { name: 'הזמן שוב' })).toBeVisible();
});
