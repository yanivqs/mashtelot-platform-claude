import { expect, test } from './fixtures';
import { FLOAT_SHOP } from './global-setup';

/** סגנון כותרת "צף": הודעת סטיקי, הסרגל שיורד לתחתית בגלילה, מגירת קטגוריות ובחירת גודל × צבע. */
test.describe('floating mobile header', () => {
  test('announcement bar links to a page on the site', async ({ page }) => {
    await page.goto(`${FLOAT_SHOP}/`);
    const bar = page.getByTestId('announcement-bar');
    await expect(bar).toContainText('פרחי העונה הגיעו');
    await bar.getByRole('link').click();
    await expect(page).toHaveURL(/\/catalog\?category=e2e-flowers/);
  });

  test('the bar moves to the bottom on scroll and back at the top; no classic bottom nav', async ({ page }) => {
    await page.goto(`${FLOAT_SHOP}/catalog`);
    await expect(page.getByRole('navigation', { name: 'ניווט תחתון' })).toHaveCount(0);
    const docked = page.getByTestId('float-bar');
    await expect(docked).toHaveAttribute('data-docked', 'false');
    await expect(page.getByRole('button', { name: 'תפריט וקטגוריות', exact: true })).toBeVisible();

    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 800);
    });
    await expect(docked).toHaveAttribute('data-docked', 'true');
    await expect(page.getByRole('button', { name: 'תפריט וקטגוריות (סרגל תחתון)' })).toBeInViewport();

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(docked).toHaveAttribute('data-docked', 'false');
  });

  test('hamburger opens categories with subcategories; search goes to the catalog', async ({ page }) => {
    await page.goto(`${FLOAT_SHOP}/`);
    await page.getByRole('button', { name: 'תפריט וקטגוריות', exact: true }).click();
    const menu = page.getByRole('navigation', { name: 'תפריט ראשי' });
    await menu.getByText('פרחים', { exact: true }).click();
    await menu.getByRole('link', { name: 'ורדים' }).click();
    await expect(page).toHaveURL(/category=e2e-roses/);
    await expect(menu).toHaveCount(0);

    await page.getByRole('banner').getByRole('button', { name: 'חיפוש', exact: true }).click();
    const input = page.getByRole('searchbox', { name: 'חיפוש', exact: true });
    await expect(input).toBeFocused();
    await input.fill('עציץ');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/catalog\?q=/);
  });

  test('choose size and color, a missing combination is disabled, and the cart keeps both', async ({ page }) => {
    await page.goto(`${FLOAT_SHOP}/catalog`);
    await page.getByRole('link', { name: 'לבחירת גודל וצבע' }).click();
    const price = page.getByTestId('variant-price');
    await expect(price).toContainText('39');

    // גדול קיים רק בכתום
    await page.locator('label', { hasText: 'גדול' }).click();
    await expect(price).toContainText('89');
    await expect(page.getByRole('radio', { name: "בז'" })).toBeDisabled();

    await page.locator('label', { hasText: 'קטן' }).click();
    await page.getByRole('radio', { name: "בז'" }).check({ force: true });
    await expect(page.getByRole('group', { name: /צבע/ })).toContainText("בז'");
    await page.getByRole('button', { name: 'הוסף לעגלה' }).click();

    await page.goto(`${FLOAT_SHOP}/cart`);
    await expect(page.getByText("עציץ מעוצב — קטן / בז'")).toBeVisible();
  });
});
