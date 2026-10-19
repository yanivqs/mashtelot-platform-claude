import { expect, test } from '@playwright/test';
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

  await page.getByRole('button', { name: /התנתק|יציאה/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
