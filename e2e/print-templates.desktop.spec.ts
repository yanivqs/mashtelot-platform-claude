import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER2, E2E_PRINT_TEMPLATE, E2E_SUPER2 as E2E_SUPER } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

test('super admin builds and publishes a template; nursery orders with conditional fields and server price (PT-02/03/07)', async ({ page }) => {
  await login(page, E2E_SUPER);
  await page.getByRole('link', { name: 'תבניות דפוס' }).click();
  await page.getByLabel('שם המוצר').fill(E2E_PRINT_TEMPLATE);
  await page.getByRole('button', { name: 'יצירה' }).click();
  await expect(page.getByRole('heading', { level: 1, name: E2E_PRINT_TEMPLATE })).toBeVisible();

  // שדה 1: חומר (בחירה, עם תוספת מחיר ל-PVC)
  await page.getByRole('button', { name: '+ הוספת שדה' }).click();
  await page.getByLabel('תווית שדה 1').fill('חומר');
  await page.getByLabel('מפתח שדה 1').fill('material');
  await page.getByLabel('סוג שדה 1').selectOption('select');
  await page.getByRole('button', { name: '+ אפשרות' }).click();
  await page.getByRole('button', { name: '+ אפשרות' }).click();
  await page.getByLabel('ערך', { exact: true }).nth(0).fill('paper');
  await page.getByLabel('תווית אפשרות').nth(0).fill('נייר');
  await page.getByLabel('ערך', { exact: true }).nth(1).fill('pvc');
  await page.getByLabel('תווית אפשרות').nth(1).fill('PVC');
  await page.getByLabel('תוספת מחיר').nth(1).fill('0.5');

  // שדה 2: סוג דבק — חובה, מוצג רק אם חומר = PVC
  await page.getByRole('button', { name: '+ הוספת שדה' }).click();
  await page.getByLabel('תווית שדה 2').fill('סוג דבק');
  await page.getByLabel('מפתח שדה 2').fill('glue');
  await page.getByLabel('סוג שדה 2').selectOption('select');
  await page.getByRole('button', { name: '+ אפשרות' }).nth(1).click();
  await page.getByLabel('ערך', { exact: true }).nth(2).fill('perm');
  await page.getByLabel('תווית אפשרות').nth(2).fill('קבוע');
  await page.getByText('חובה').nth(1).click();
  await page.getByLabel('שדה תנאי').first().selectOption('material');
  await page.getByLabel('ערך תנאי').selectOption('pvc');

  // שדה 3: טקסט להדפסה
  await page.getByRole('button', { name: '+ הוספת שדה' }).click();
  await page.getByLabel('תווית שדה 3').fill('טקסט');
  await page.getByLabel('מפתח שדה 3').fill('text');
  await page.getByText('חובה').nth(2).click();

  // תמחור
  await page.getByLabel('מחיר בסיס ליחידה (₪)').fill('1');
  await page.getByLabel('עלות הקמה להזמנה (₪)').fill('50');
  await page.getByLabel('כמות מינימום').fill('100');
  await page.getByText('הצעת מחיר בלבד').click(); // ברירת המחדל מסומנת — מבטלים
  await page.getByLabel(/מדרגות כמות/).fill('500 | 0.8');

  await page.getByRole('button', { name: 'שמירת טיוטה' }).click();
  await expect(page.getByText('הטיוטה נשמרה ✓')).toBeVisible();
  await page.getByRole('button', { name: 'פרסום גרסה 1' }).click();
  // אחרי פרסום — הגרסה נעולה, והעורך מוחלף בכפתור "גרסה חדשה"
  await expect(page.getByRole('heading', { name: 'גרסה 1 — מפורסמת (נעולה)' })).toBeVisible();
  await expect(page.getByText('מוצג רק אם חומר = PVC')).toBeVisible();
  await expect(page.getByRole('button', { name: 'יצירת גרסה חדשה (טיוטה)' })).toBeVisible();
  await page.getByText('מוצג למשתלות להזמנה').click();
  await page.getByRole('button', { name: 'שמירת פרטי המוצר' }).click();
  await expect(page.getByText('נשמר ✓')).toBeVisible();

  // בעל המשתלה מזמין
  await login(page, E2E_OWNER2);
  await page.goto(`${ADMIN}/admin/print-shop`);
  const card = page.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: E2E_PRINT_TEMPLATE }) });
  await card.getByRole('button', { name: 'הזמנה' }).click();

  await expect(card.getByLabel('סוג דבק')).toHaveCount(0); // מוסתר עד שבוחרים PVC
  await card.getByLabel('חומר').selectOption('pvc');
  await expect(card.getByLabel('סוג דבק')).toBeVisible();
  await card.getByLabel('טקסט').fill('ורד אדום');
  await card.getByLabel(/^כמות/).fill('500');

  // בלי סוג דבק — השרת מחזיר שגיאת שדה
  await card.getByRole('button', { name: 'שליחת הזמנה' }).click();
  await expect(card.getByText('יש לבחור')).toBeVisible();

  await card.getByLabel('סוג דבק').selectOption('perm');
  // (0.8 מדרגת 500 + 0.5 PVC) × 500 + הקמה 50 = 700
  await expect(card.getByText(/מחיר משוער/)).toContainText('700');
  await card.getByRole('button', { name: 'שליחת הזמנה' }).click();
  await expect(card.getByText(/ההזמנה התקבלה ✓/)).toBeVisible();

  // בית הדפוס רואה את ההזמנה עם הערכים
  await login(page, E2E_SUPER);
  await page.goto(`${ADMIN}/admin/print-orders`);
  await expect(page.getByText(`${E2E_PRINT_TEMPLATE} × 500`)).toBeVisible();
  await expect(page.getByText('חומר: PVC · סוג דבק: קבוע · טקסט: ורד אדום')).toBeVisible();
});
