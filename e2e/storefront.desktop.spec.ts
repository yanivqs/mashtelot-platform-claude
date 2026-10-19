import { expect, test } from './fixtures';
import { SHOP } from '../playwright.config';

test('desktop: no bottom nav, cart in the header', async ({ page }) => {
  await page.goto(`${SHOP}/`);
  await expect(page.getByRole('navigation', { name: 'ניווט תחתון' })).toBeHidden();
  await expect(page.locator('header').getByRole('link', { name: /עגלת קניות/ }).first()).toBeVisible();
});
