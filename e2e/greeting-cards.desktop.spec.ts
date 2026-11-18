import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_CARDS_OWNER, E2E_CARDS_TEMPLATE, E2E_SUPER9 } from './global-setup';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

/** בוחר את הדוגמאות SC9000..SC9000+n-1 (בסדר המאגר) */
async function pick(page: Page, from: number, to: number) {
  for (let i = from; i < to; i += 1) await page.getByTestId(`design-SC${9000 + i}`).getByRole('checkbox').check();
}

test('greeting cards: category → subcategory → pick designs in multiples of 8 → logo and details → order in the print queue', async ({ page }) => {
  await login(page, E2E_CARDS_OWNER);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await page.getByTestId('print-categories').getByRole('link', { name: /כרטיסי ברכה E2E/ }).click();
  await page.getByTestId('print-categories').getByRole('link', { name: /כרטיסים קטנים E2E/ }).click();
  await page.getByRole('link', { name: new RegExp(`^${E2E_CARDS_TEMPLATE} 17 דוגמאות`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: E2E_CARDS_TEMPLATE })).toBeVisible();

  const status = page.getByTestId('design-status');
  const next = page.getByRole('button', { name: 'המשך להזמנה' });
  await expect(status).toHaveText('יש לבחור לפחות 8 דוגמאות לביצוע הזמנה');
  await expect(next).toBeDisabled();

  // 7 — חסום
  await pick(page, 0, 7);
  await expect(status).toHaveText('יש לבחור לפחות 8 דוגמאות לביצוע הזמנה (נבחרו 7, חסרות 1)');
  await expect(next).toBeDisabled();

  // 8 — 400 מכל דוגמא, 3,200 יח', 0.40 ₪ לכרטיס
  await pick(page, 7, 8);
  await expect(status).toContainText("400 מכל דוגמא · 3,200 יח'");
  await expect(status).toContainText('1,280');
  await expect(next).toBeEnabled();

  // 9 — כפולות של 8 בלבד
  await pick(page, 8, 9);
  await expect(status).toHaveText('ניתן להזמין בכפולות של 8 דוגמאות בלבד. נבחרו 9: הסירו 1 דוגמא או הוסיפו עוד 7');
  await expect(next).toBeDisabled();

  // סינון לפי תגית וחיפוש לא משנים את הבחירה
  await page.getByRole('button', { name: /^מזל טוב/ }).click();
  await expect(page.getByTestId('design-grid').locator('li')).toHaveCount(8);
  await page.getByRole('button', { name: /^הכול/ }).click();
  await expect(page.getByTestId('design-grid').locator('li')).toHaveCount(17);

  // 16 — 200 מכל דוגמא
  await pick(page, 9, 16);
  await expect(status).toContainText("200 מכל דוגמא · 3,200 יח'");

  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // פרטי ההזמנה: לוגו ופרטי עסק חובה
  await next.click();
  await expect(page.getByRole('heading', { name: 'פרטי ההזמנה' })).toBeFocused();
  await expect(page.getByTestId('design-selected').locator('li')).toHaveCount(16);
  const send = page.getByRole('button', { name: 'שליחת ההזמנה' });
  await expect(send).toBeDisabled();
  await expect(page.getByTestId('design-bar')).toContainText('יש להעלות קובץ לוגו');
  await page.getByLabel('העלאת לוגו').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByTestId('print-file')).toContainText('logo.png');
  await page.getByLabel(/פרטי העסק להדפסה/).fill('משתלת הכרטיסים · 03-5555555');
  await page.getByLabel('הערות לבית הדפוס').fill('בעברית בבקשה');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByTestId('print-confirmation')).toContainText("16 דוגמאות × 200 יח' = 3,200 כרטיסים");
  await expect(page.getByTestId('print-confirmation')).toContainText('1,280');

  // בית הדפוס רואה בתור ההזמנות את הדוגמאות ואת הכמות לכל אחת
  await login(page, E2E_SUPER9);
  await page.goto(`${ADMIN}/admin/print-orders`);
  const order = page.locator('div.rounded-xl').filter({ hasText: 'משתלת הכרטיסים · 03-5555555' }).first();
  await expect(order).toContainText("דוגמאות (16 × 200 יח')");
  await expect(order).toContainText('SC9000');
  await expect(order).toContainText('SC9015');
  await expect(order).not.toContainText('SC9016');
});
