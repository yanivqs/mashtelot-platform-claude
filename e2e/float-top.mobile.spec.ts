import { expect, test } from './fixtures';
import { FIX_SHOP } from './global-setup';

test('floatTop header: logo, menu and search stay pinned at the top while scrolling', async ({ page }) => {
  await page.goto(`${FIX_SHOP}/catalog`);
  const header = page.getByRole('banner');
  await expect(header.getByRole('button', { name: 'תפריט וקטגוריות' })).toBeVisible();
  // אין עותק תחתון ואין ניווט תחתון קלאסי
  await expect(page.getByTestId('float-bar')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: /ניווט תחתון/ })).toHaveCount(0);

  await page.evaluate(() => {
    document.body.style.minHeight = '3000px';
    window.scrollTo(0, 1200);
  });
  await expect.poll(async () => (await header.boundingBox())?.y ?? -1).toBe(0);
  await header.getByRole('button', { name: 'חיפוש' }).click();
  await expect(page.getByRole('searchbox', { name: 'חיפוש', exact: true })).toBeFocused();
});
