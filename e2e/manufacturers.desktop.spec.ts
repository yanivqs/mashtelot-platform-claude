import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_MFR_OWNER, E2E_MFR_PREFIX, E2E_SUPER10, MFR_SHOP } from './global-setup';

const NAME = `${E2E_MFR_PREFIX} גינה`;

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

/** תמונה בלי העלאה לאחסון: ממלאים את השדה הנסתר של רכיב ההעלאה */
async function setHidden(page: Page, name: string, value: string) {
  await page.locator(`input[type="hidden"][name="${name}"]`).first().evaluate((el, v) => ((el as HTMLInputElement).value = v), value);
}

async function noAxe(page: Page, selector?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  const { violations } = await (selector ? builder.include(selector) : builder).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('manufacturers: super admin adds a manufacturer and products, the nursery pulls them, the store shows and filters by manufacturer', async ({ page }) => {
  // סופר-אדמין: יצרן עם לוגו, ושני מוצרים עם קוד יצרן, ברקוד ומחיר מומלץ
  await login(page, E2E_SUPER10);
  await page.goto(`${ADMIN}/admin/manufacturers`);
  await page.getByLabel('שם הספק / היצרן').fill(NAME);
  await setHidden(page, 'logoUrl', '/file.svg');
  await page.getByRole('button', { name: 'הוספת ספק / יצרן' }).click();
  await expect(page.getByRole('heading', { level: 1, name: NAME })).toBeVisible();
  await noAxe(page, 'main');

  for (const [title, code, barcode, price] of [
    ['מזמרה E2E', 'MZ-1', '7290000000017', '49.90'],
    ['כפפות E2E', 'GL-2', '', ''],
  ]) {
    await page.getByRole('link', { name: `מוצר חדש ל${NAME}` }).click();
    await expect(page.getByLabel('ספק / יצרן')).toHaveValue(/.+/);
    await page.getByLabel('שם המוצר').fill(title!);
    await page.getByLabel('קוד יצרן').fill(code!);
    await page.getByLabel('ברקוד').fill(barcode!);
    await page.getByLabel(/מחיר מומלץ/).fill(price!);
    await setHidden(page, 'imageUrl', '/file.svg');
    await page.getByRole('button', { name: 'הוספת מוצר' }).click();
    await expect(page.getByText('המוצר נוסף לקטלוג ✓')).toBeVisible();
    await page.getByRole('link', { name: 'חזרה לספק / יצרן' }).click();
  }
  await expect(page.getByText('מוצרים בקטלוג (2)')).toBeVisible();

  // בעל משתלה: סינון לפי היצרן, "סמן הכול" והוספה
  await login(page, E2E_MFR_OWNER);
  await page.goto(`${ADMIN}/admin/products/browse?tab=supplies`);
  await page.getByRole('navigation', { name: 'ספקים ויצרנים' }).getByRole('link', { name: new RegExp(NAME) }).click();
  await page.getByLabel(`סמן את כל מוצרי ${NAME}`).check();
  await expect(page.getByText('נבחרו 2')).toBeVisible();
  await page.getByRole('button', { name: 'הוסף 2 מוצרים לחנות' }).click();
  await expect(page.getByTestId('bulk-added')).toContainText('נוספו 2 מוצרים לחנות.');
  await expect(page.getByText('בחנות ✓')).toHaveCount(2);
  await noAxe(page, 'main');

  // המוצר שנמשך: יצרן, קוד וברקוד מהקטלוג; מעלים תמונה משלנו כדי שיוצג בחנות
  await page.goto(`${ADMIN}/admin/products?q=${encodeURIComponent('מזמרה E2E')}`);
  await page.getByRole('link', { name: 'מזמרה E2E' }).first().click();
  await expect(page.getByLabel('ספק / יצרן')).toHaveValue(/.+/);
  await expect(page.getByLabel('ספק / יצרן').locator('option:checked')).toHaveText(NAME);
  await expect(page.locator('input[name="manufacturerCode"]')).toHaveValue('MZ-1');
  await expect(page.locator('input[name="variantBarcode"]')).toHaveValue('7290000000017');
  await expect(page.locator('input[name="price"]')).toHaveValue('49.9');
  await setHidden(page, 'customImageUrl', '/file.svg');
  await page.getByRole('button', { name: 'שמירה', exact: true }).first().click();
  await expect(page.getByText('נשמר ✓')).toBeVisible();

  // מוצר שבעל המשתלה יוצר בעצמו — עם יצרן מהרשימה
  await page.goto(`${ADMIN}/admin/products/new`);
  await page.locator('input[name="customTitle"]').fill('מוצר שלי E2E');
  await page.locator('input[name="price"]').fill('12');
  await page.getByLabel('ספק / יצרן').selectOption({ label: NAME });
  await page.locator('input[name="manufacturerCode"]').fill('OWN-7');
  await page.locator('input[name="variantBarcode"]').fill('7290000000055');
  await page.getByRole('button', { name: 'יצירת מוצר' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin/products`);
  await page.goto(`${ADMIN}/admin/products?q=${encodeURIComponent('מוצר שלי E2E')}`);
  await page.getByRole('link', { name: 'מוצר שלי E2E' }).first().click();
  await expect(page.getByLabel('ספק / יצרן').locator('option:checked')).toHaveText(NAME);
  await expect(page.locator('input[name="variantBarcode"]')).toHaveValue('7290000000055');

  // החנות: מסנן היצרן ודף המוצר
  await page.goto(`${MFR_SHOP}/catalog`);
  const facet = page.getByRole('link', { name: new RegExp(`${NAME}\\s*2`) }).first();
  await facet.click();
  await expect(page).toHaveURL(/brand=/);
  await expect(page.getByRole('status').filter({ hasText: 'מוצרים' })).toHaveText('2 מוצרים');
  await page.getByRole('link', { name: 'מזמרה E2E' }).first().click();
  await expect(page.getByTestId('product-manufacturer')).toContainText(NAME);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.join('\n')).toContain(`"brand":{"@type":"Brand","name":"${NAME}"}`);
  expect(ld.join('\n')).toContain('"mpn":"MZ-1"');
  await noAxe(page);
});
