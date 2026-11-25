import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_MFR_OWNER, E2E_PLANT_PREFIX, E2E_SUPER10, MFR_SHOP } from './global-setup';

const NAME = `${E2E_PLANT_PREFIX} לבנדר`;

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

async function setHidden(page: Page, name: string, value: string) {
  await page.locator(`input[type="hidden"][name="${name}"]`).first().evaluate((el, v) => ((el as HTMLInputElement).value = v), value);
}

async function noAxe(page: Page, selector?: string) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  const { violations } = await (selector ? builder.include(selector) : builder).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test('nursery plants: the owner creates a plant with botanical details, the store shows and filters it, super admin promotes it, local edits', async ({ page }) => {
  // בעל משתלה: צמח חדש עם תאורה והשקיה
  await login(page, E2E_MFR_OWNER);
  await page.goto(`${ADMIN}/admin/products/new`);
  await expect(page.getByRole('radio', { name: /צמח/ })).toBeChecked();
  await page.locator('input[name="plant_hebrewName"]').fill(NAME);
  await page.locator('input[name="plant_latinName"]').fill('Lavandula e2e');
  await page.locator('input[name="plant_light"]').fill('שמש מלאה');
  await page.locator('input[name="plant_water"]').fill('מועטה');
  await page.locator('input[name="plant_height"]').fill('60 ס"מ');
  await page.locator('input[name="price"]').fill('30');
  await setHidden(page, 'customImageUrl', '/file.svg');
  await expect(page.getByLabel(/הצע את הצמח לקטלוג הראשי/)).toBeChecked();
  await noAxe(page, 'main');
  await page.getByRole('button', { name: 'יצירת מוצר' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin/products`);

  // החנות: מסנן "תאורה: שמש מלאה" מוצא אותו, ודף המוצר מציג את הפרטים
  await page.goto(`${MFR_SHOP}/catalog?light=sun`);
  await page.getByRole('link', { name: NAME }).first().click();
  await expect(page.getByText('מועטה').first()).toBeVisible();
  await expect(page.getByText('60 ס"מ').first()).toBeVisible();

  // סופר-אדמין: ההצעה ברשימה, והוספה לקטלוג הראשי
  await login(page, E2E_SUPER10);
  await page.goto(`${ADMIN}/admin/catalog?view=suggested`);
  await page.getByRole('link', { name: new RegExp(NAME) }).click();
  await expect(page.getByTestId('nursery-plant-banner')).toContainText('משתלת היצרנים');
  await noAxe(page, 'main');
  await page.getByRole('button', { name: 'הוסף לקטלוג הראשי' }).click();
  await expect(page.getByTestId('nursery-plant-banner')).toHaveCount(0);

  // בעל המשתלה: עכשיו זה צמח מהקטלוג — שינוי נשמר מקומית לחנות שלו
  await login(page, E2E_MFR_OWNER);
  await page.goto(`${ADMIN}/admin/products?q=${encodeURIComponent(NAME)}`);
  await page.getByRole('link', { name: NAME }).first().click();
  await page.locator('input[name="plant_light"]').fill('הצללה חלקית');
  await page.getByRole('button', { name: 'שמירת פרטי הצמח' }).click();
  await expect(page.getByText('שונה מקומית')).toBeVisible();
  await expect(page.locator('input[name="plant_light"]')).toHaveValue('הצללה חלקית');
  await noAxe(page, 'main');

  await page.goto(`${MFR_SHOP}/catalog?light=partial`);
  await page.getByRole('link', { name: NAME }).first().click();
  await expect(page.getByText('הצללה חלקית').first()).toBeVisible();
  await noAxe(page);
});
