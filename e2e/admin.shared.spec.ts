import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER } from './global-setup';

test('admin login: wrong password is refused, correct one logs in, logout returns to login', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER.email);
  await page.locator('input[name="password"]').fill('wrong-password-1');
  await page.getByRole('button', { name: /התחבר|כניסה/ }).click();
  await expect(page.getByText('פרטי התחברות שגויים')).toBeVisible();
  // React 19 מאפס טפסים אחרי Action — האימייל חייב להישאר
  await expect(page.locator('input[name="email"]')).toHaveValue(E2E_OWNER.email);

  await page.locator('input[name="password"]').fill(E2E_OWNER.password);
  await page.getByRole('button', { name: /התחבר|כניסה/ }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  // בנייד התפריט (וההתנתקות) במגירה
  const openMenu = page.getByRole('button', { name: 'פתיחת תפריט הניהול' });
  if (await openMenu.isVisible()) await openMenu.click();
  await page.getByRole('button', { name: /התנתק|יציאה/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
