import { expect, test, type Page } from './fixtures';
import { ADMIN, SHOP } from '../playwright.config';
import { E2E_OWNER9 } from './global-setup';

async function waitSaved(page: Page) {
  await expect(page.getByTestId('draft-status')).toHaveText('הטיוטה נשמרה');
}

test('owner builds the home page from blocks: preview, publish, schedule, restore, turn off (R03)', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER9.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER9.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.getByRole('link', { name: 'עיצוב דף הבית' }).click();
  await expect(page.getByRole('heading', { name: 'עיצוב דף הבית' })).toBeVisible();

  // באנר עם קישור לא בטוח — נדחה בשרת, הטיוטה לא נשמרת
  await page.getByLabel('סוג בלוק להוספה').selectOption('cta');
  await page.getByRole('button', { name: 'הוספת בלוק' }).click();
  await page.getByLabel('כותרת *').fill('מבצע אביב E2E');
  await page.getByLabel('קישור הכפתור (/catalog או https://…)').fill('javascript:alert(1)');
  await expect(page.getByText('קישור חייב להיות נתיב באתר')).toBeVisible();
  await page.getByLabel('קישור הכפתור (/catalog או https://…)').fill('/catalog');
  await waitSaved(page);

  // תצוגה מקדימה של הטיוטה — אותם רכיבים של החנות
  const preview = page.frameLocator('iframe[title="תצוגה מקדימה"]');
  await expect(preview.getByRole('heading', { name: 'מבצע אביב E2E' })).toBeVisible();

  // לפני פרסום — החנות עדיין בתצוגה הרגילה
  const shop = await page.context().newPage();
  await shop.goto(`${SHOP}/`);
  await expect(shop.getByText('מבצע אביב E2E')).toHaveCount(0);

  await page.getByRole('button', { name: 'פרסום', exact: true }).click();
  await expect(page.getByText('גרסה 1 פורסמה ✓')).toBeVisible();
  await shop.goto(`${SHOP}/`);
  await expect(shop.getByRole('heading', { name: 'מבצע אביב E2E' })).toBeVisible();

  // שינוי ותזמון למחר — החנות עוד מציגה את גרסה 1
  await page.getByRole('button', { name: /באנר קריאה לפעולה/ }).first().click();
  if (!(await page.getByLabel('כותרת *').isVisible())) await page.getByRole('button', { name: /באנר קריאה לפעולה/ }).first().click();
  await page.getByLabel('כותרת *').fill('מבצע קיץ E2E');
  await waitSaved(page);
  await page.getByLabel('בתאריך').check();
  const tomorrow = new Date(Date.now() + 24 * 3600_000);
  const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }).format(tomorrow).replace(' ', 'T');
  await page.getByLabel('מועד הפרסום').fill(local);
  await page.getByRole('button', { name: 'תזמון פרסום' }).click();
  await expect(page.getByText('גרסה 2 תוזמנה לפרסום ✓')).toBeVisible();
  await expect(page.getByTestId('layout-version').filter({ hasText: 'מתוזמנת' })).toHaveCount(1);
  await shop.goto(`${SHOP}/`);
  await expect(shop.getByRole('heading', { name: 'מבצע אביב E2E' })).toBeVisible();
  await expect(shop.getByText('מבצע קיץ E2E')).toHaveCount(0);

  // שחזור גרסה 1 לטיוטה
  await page.getByTestId('layout-version').filter({ hasText: 'גרסה 1' }).getByRole('button', { name: 'שחזור לטיוטה' }).click();
  await expect(page.getByText('גרסה 1 הועתקה לטיוטה')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /באנר קריאה לפעולה/ }).first().click();
  if (!(await page.getByLabel('כותרת *').isVisible())) await page.getByRole('button', { name: /באנר קריאה לפעולה/ }).first().click();
  await expect(page.getByLabel('כותרת *')).toHaveValue('מבצע אביב E2E');

  // ביטול התזמון, וחזרה לתצוגה הרגילה
  await page.getByTestId('layout-version').filter({ hasText: 'מתוזמנת' }).getByRole('button', { name: 'ביטול התזמון' }).click();
  await expect(page.getByText('התזמון בוטל')).toBeVisible();
  await page.getByRole('button', { name: 'חזרה לתצוגה הרגילה' }).click();
  await expect(page.getByText('החנות חזרה לתצוגה הרגילה')).toBeVisible();
  await shop.goto(`${SHOP}/`);
  await expect(shop.getByText('מבצע אביב E2E')).toHaveCount(0);
  await expect(shop.getByRole('heading', { name: 'מוצרים נבחרים' })).toBeVisible();
});

test('a static page can be built from blocks and keeps its title and address (R03)', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER9.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER9.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  await page.goto(`${ADMIN}/admin/pages/new`);
  await page.locator('input[name="title"]').fill('שאלות E2E');
  await page.locator('input[name="slug"]').fill('faq-e2e');
  await page.locator('input[name="isPublished"]').check();
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin/pages`);
  await page.getByRole('link', { name: /שאלות E2E/ }).click();
  await page.getByRole('link', { name: 'בנייה בבלוקים' }).click();

  await page.getByLabel('סוג בלוק להוספה').selectOption('faq');
  await page.getByRole('button', { name: 'הוספת בלוק' }).click();
  await page.getByRole('button', { name: '+ הוספת שאלה' }).click();
  await page.getByLabel('שאלה 1').fill('מתי משקים לבנדר?');
  await page.getByLabel('תשובה').fill('פעם בשבוע בקיץ.');
  await waitSaved(page);
  await page.getByRole('button', { name: 'פרסום', exact: true }).click();
  await expect(page.getByText('גרסה 1 פורסמה ✓')).toBeVisible();

  await page.goto(`${SHOP}/faq-e2e`);
  await expect(page.getByRole('heading', { level: 1, name: 'שאלות E2E' })).toBeVisible();
  await page.getByText('מתי משקים לבנדר?').click();
  await expect(page.getByText('פעם בשבוע בקיץ.')).toBeVisible();
});
