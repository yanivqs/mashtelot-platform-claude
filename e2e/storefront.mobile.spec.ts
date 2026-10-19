import { expect, test } from './fixtures';
import { SHOP } from '../playwright.config';

test.describe('mobile storefront', () => {
  test('bottom nav is shown and the top header has no cart', async ({ page }) => {
    await page.goto(`${SHOP}/`);
    const nav = page.getByRole('navigation', { name: 'ניווט תחתון' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'בית' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('header').getByRole('link', { name: /עגלת קניות/ })).toHaveCount(0);
  });

  test('search drawer opens, focuses and searches the catalog', async ({ page }) => {
    await page.goto(`${SHOP}/`);
    const nav = page.getByRole('navigation', { name: 'ניווט תחתון' });
    await nav.getByRole('button', { name: 'חיפוש' }).click();
    const input = page.getByRole('searchbox', { name: 'חיפוש' });
    await expect(input).toBeFocused();
    await input.fill('לבנדר');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/catalog\?q=/);
    await expect(page.getByText('לבנדר רפואי')).toBeVisible();
    await expect(page.getByText('זית סורי')).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'קטלוג' })).toHaveAttribute('aria-current', 'page');
  });

  test('add to cart → bottom cart badge → checkout with pay-on-pickup', async ({ page }) => {
    await page.goto(`${SHOP}/catalog`);
    await page
      .locator('article, li, div')
      .filter({ hasText: 'ורד אדום' })
      .getByRole('button', { name: 'הוסף לעגלה' })
      .first()
      .click();
    const cart = page.getByRole('navigation', { name: 'ניווט תחתון' }).getByRole('link', { name: /עגלת קניות, 1 פריטים/ });
    await expect(cart).toBeVisible();

    await page.goto(`${SHOP}/checkout`);
    await page.locator('input[name="customerName"]').fill('לקוח E2E');
    await page.locator('input[name="customerPhone"]').fill('050-1234567');
    await page.locator('input[name="customerEmail"]').fill('buyer@e2e.invalid');

    // משלוח: "תשלום לשליח" ו-PayPal מוצגים, "תשלום באיסוף" לא
    await page.locator('label', { hasText: 'משלוח עד הבית' }).click();
    await expect(page.getByLabel('תשלום לשליח')).toBeVisible();
    await expect(page.getByLabel('PayPal')).toBeVisible();
    await expect(page.getByLabel('תשלום באיסוף')).toHaveCount(0);

    // איסוף: ההפך
    await page.locator('label', { hasText: 'איסוף עצמי מהמשתלה' }).click();
    await expect(page.getByLabel('תשלום באיסוף')).toBeVisible();
    await expect(page.getByLabel('תשלום לשליח')).toHaveCount(0);

    await page.getByLabel('תשלום באיסוף').check();
    await expect(page.getByText('מזומן או אשראי בקופה')).toBeVisible();
    await expect(page.locator('input[name="paymentReference"]')).toHaveCount(0);

    await page.getByRole('button', { name: /שליחת ההזמנה|סיום|הזמנה/ }).click();
    await expect(page).toHaveURL(/\/checkout\/success\//);
    await expect(page.getByRole('heading', { name: 'ההזמנה התקבלה!' })).toBeVisible();
  });

  test('PayPal shows the payment link and a reference field', async ({ page }) => {
    await page.goto(`${SHOP}/catalog`);
    await page
      .locator('article, li, div')
      .filter({ hasText: 'זית סורי' })
      .getByRole('button', { name: 'הוסף לעגלה' })
      .first()
      .click();
    await page.goto(`${SHOP}/checkout`);
    await page.locator('label', { hasText: 'איסוף עצמי מהמשתלה' }).click();
    await page.getByLabel('PayPal').check();
    await expect(page.getByRole('link', { name: 'https://paypal.me/e2e-shop' })).toHaveAttribute('target', '_blank');
    await expect(page.locator('input[name="paymentReference"]')).toBeVisible();
  });
});
