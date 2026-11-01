import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_FLOAT_OWNER } from './global-setup';

test('admin on a phone: the menu is a drawer and content uses the full width', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_FLOAT_OWNER.email);
  await page.locator('input[name="password"]').fill(E2E_FLOAT_OWNER.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  const menu = page.getByRole('complementary', { name: 'תפריט הניהול' });
  await expect(menu).not.toBeInViewport();
  const width = page.viewportSize()!.width;
  expect((await page.locator('main').boundingBox())!.width).toBeGreaterThan(width * 0.9);

  await page.getByRole('button', { name: 'פתיחת תפריט הניהול' }).click();
  await expect(menu).toBeInViewport();
  await menu.getByRole('link', { name: 'המלאי שלי' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin/products`);
  await expect(menu).not.toBeInViewport();
  await expect(page.getByRole('heading', { name: 'המלאי שלי' })).toBeVisible();
});
