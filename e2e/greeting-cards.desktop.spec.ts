import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_CARDS_OWNER, E2E_CARDS_TEMPLATE, E2E_SUPER9 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

/** בוחר את הדוגמאות SC9000+from..SC9000+to-1 */
async function pick(page: Page, from: number, to: number) {
  for (let i = from; i < to; i += 1) await page.getByTestId(`design-SC${9000 + i}`).getByRole('checkbox').check();
}

test('greeting cards: pick designs, quantity per design in the fixed order bar, dedicated design, order without a logo', async ({ page }) => {
  await login(page, E2E_CARDS_OWNER);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await page.getByTestId('print-categories').getByRole('link', { name: /כרטיסי ברכה E2E/ }).click();
  await page.getByTestId('print-categories').getByRole('link', { name: /כרטיסים קטנים E2E/ }).click();
  await page.getByRole('link', { name: new RegExp(`^${E2E_CARDS_TEMPLATE} 17 דוגמאות`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: E2E_CARDS_TEMPLATE })).toBeVisible();

  // דוגמא ייעודית: רק של המשתלה הזו, ראשונה ומסומנת; של משתלה אחרת — לא מוצגת
  const grid = page.getByTestId('design-grid');
  await expect(grid.locator('li')).toHaveCount(18);
  await expect(grid.locator('li').first()).toContainText('הוכנה עבורכם');
  await expect(page.getByTestId('design-SC9100')).toBeVisible();
  await expect(page.getByTestId('design-SC9200')).toHaveCount(0);
  await page.getByRole('button', { name: /^הוכנו עבורכם/ }).click();
  await expect(grid.locator('li')).toHaveCount(1);
  await page.getByRole('button', { name: /^הכול/ }).click();

  const bar = page.getByTestId('design-bar');
  const status = page.getByTestId('design-status');
  const next = page.getByRole('button', { name: 'המשך להזמנה' });
  await expect(status).toHaveText('יש לבחור לפחות 8 דוגמאות לביצוע הזמנה');
  await expect(next).toBeDisabled();

  // כל בחירה מתווספת לפס
  await pick(page, 0, 7);
  await expect(page.getByTestId('design-selected').locator('li')).toHaveCount(7);
  await expect(status).toHaveText('יש לבחור לפחות 8 דוגמאות לביצוע הזמנה (נבחרו 7, חסרות 1)');

  // 8: ברירת מחדל 400 מכל דוגמא, 3,200 כרטיסים, 0.40 ₪ לכרטיס
  await pick(page, 7, 8);
  await expect(bar).toContainText('נבחרו 8 דוגמאות · 3,200 כרטיסים');
  await expect(bar).toContainText('1,280');
  await expect(status).toHaveText('ההזמנה תקינה');
  await expect(next).toBeEnabled();

  // כמות לכל דוגמא, בקפיצות של 200; סך הכול לפחות 3,200
  await bar.getByLabel('כמות מ-SC9000').selectOption('200');
  await expect(status).toHaveText('סך הכול לפחות 3,200 כרטיסים (כרגע 3,000). הגדילו את הכמות באחת הדוגמאות');
  await expect(next).toBeDisabled();
  await bar.getByLabel('כמות מ-SC9001').selectOption('1000');
  await expect(bar).toContainText('3,600 כרטיסים');
  await expect(bar).toContainText('1,440');

  // הסרה מהפס
  await bar.getByRole('button', { name: 'הסרת SC9007' }).click();
  await expect(page.getByTestId('design-SC9007').getByRole('checkbox')).not.toBeChecked();
  await expect(status).toContainText('נבחרו 7, חסרות 1');
  await pick(page, 7, 9);
  await expect(status).toHaveText('ניתן להזמין בכפולות של 8 דוגמאות בלבד. נבחרו 9: הסירו 1 דוגמא או הוסיפו עוד 7');

  // 16: דוגמא בלי כמות שנבחרה — 200; הכמויות שנבחרו נשמרות (200 + 1,000 + 14 × 200 = 4,000)
  await pick(page, 9, 16);
  await expect(bar).toContainText('נבחרו 16 דוגמאות · 4,000 כרטיסים');
  await expect(bar.getByLabel('כמות מ-SC9005')).toHaveValue('200');

  // הפס נשאר על המסך גם בגלילה לסוף המאגר
  await grid.locator('li').last().scrollIntoViewIfNeeded();
  await expect(bar).toBeInViewport();

  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // פרטי ההזמנה: לוגו רשות, פרטי עסק חובה
  await next.click();
  await expect(page.getByRole('heading', { name: 'פרטי ההזמנה' })).toBeFocused();
  const send = page.getByRole('button', { name: 'שליחת ההזמנה' });
  await expect(send).toBeDisabled();
  await page.getByLabel(/פרטי העסק להדפסה/).fill('משתלת הכרטיסים · 03-5555555');
  await page.getByLabel('הערות לבית הדפוס').fill('בעברית בבקשה');
  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByTestId('print-confirmation')).toContainText('16 דוגמאות · 4,000 כרטיסים');
  await expect(page.getByTestId('print-confirmation')).toContainText('1,600');

  // בית הדפוס רואה בתור ההזמנות את הדוגמאות ואת הכמות מכל אחת
  await login(page, E2E_SUPER9);
  await page.goto(`${ADMIN}/admin/print-orders`);
  const order = page.locator('div.rounded-xl').filter({ hasText: 'משתלת הכרטיסים · 03-5555555' }).first();
  await expect(order).toContainText('דוגמאות (16, סה"כ 4,000 יח\')');
  await expect(order).toContainText('×1,000');
  await expect(order).toContainText('SC9015');
  await expect(order).not.toContainText('SC9016');
});
