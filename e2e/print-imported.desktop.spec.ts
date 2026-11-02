import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER8, E2E_SUPER6 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

const NAME = 'שלט כניסה מהדפסה קודמת';
const PNG = {
  name: 'שלט.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
};

test('super admin adds a past job; the owner sees it in My jobs and orders it again through a quote', async ({ page, browser }) => {
  test.setTimeout(90000);
  const superCtx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '10.78.0.1' } });
  const admin = await superCtx.newPage();
  await login(admin, E2E_SUPER6);
  await login(page, E2E_OWNER8);

  await admin.getByRole('link', { name: 'עבודות קודמות' }).click();
  await expect(admin.getByRole('heading', { level: 1, name: 'עבודות קודמות' })).toBeVisible();

  // המשתלה של הבעלים שבבדיקה
  await admin.locator('select').first().selectOption({ label: 'משתלת E2E' });
  await admin.getByLabel('שם העבודה').fill(NAME);
  await admin.getByLabel('תיאור העבודה').fill('פורקס 40x30, הדפסה דו צדדית');
  await admin.getByLabel('תאריך הזמנה').fill('2026-03-15');
  await admin.getByLabel('כמות', { exact: true }).fill('12');
  await admin.getByLabel(/^מחיר/).fill('480');
  await admin.getByRole('button', { name: 'הוספת העבודה' }).click();

  const job = admin.getByTestId('imported-job').filter({ hasText: NAME });
  await expect(job).toContainText('כמות 12');
  await expect(job).toContainText('480');
  await expect(job).toContainText('בלי מוצר מהקטלוג');
  await job.getByLabel('העלאת קובץ העבודה').setInputFiles(PNG);
  await expect(job).toContainText('שלט.png');
  await expect(job.locator('img')).toBeVisible();

  // בעל המשתלה רואה את העבודה עם כל הפרטים
  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
  const card = page.getByTestId('job-card').filter({ hasText: NAME });
  await expect(card).toContainText('פורקס 40x30, הדפסה דו צדדית');
  await expect(card).toContainText(/15\.3\.2026|15\.03\.2026/);
  await expect(card).toContainText(/כמות:\s*12/);
  await expect(card).toContainText(/מחיר אחרון:.*480/);
  await expect(card.locator('img')).toBeVisible();
  await expect(card.getByRole('link', { name: 'הזמנה דומה' })).toHaveCount(0);

  // הזמנה חוזרת של עבודה בלי מוצר: בקשת הצעת מחיר
  await card.getByRole('button', { name: 'הזמן שוב' }).click();
  await card.getByLabel('כמות').fill('20');
  await card.getByRole('button', { name: 'שליחה לבקשת מחיר' }).click();
  await expect(card.getByText(/הבקשה נשלחה לבית הדפוס/)).toBeVisible();

  // בית הדפוס מקבל בקשה, וההזמנה המיובאת לא מופיעה בתור
  await admin.goto(`${ADMIN}/admin/print-orders`);
  const panel = admin.locator('div.rounded-xl').filter({ hasText: `${NAME} × 20` }).getByTestId('quote-panel');
  await expect(panel).toContainText('עבודה מהדפסה קודמת');
  await expect(admin.getByText(`${NAME} × 12`)).toHaveCount(0);
  await panel.getByLabel('מחיר כולל להצעה').fill('700');
  await panel.getByRole('button', { name: 'שליחת הצעה למשתלה' }).click();
  await expect(panel.getByText('נשלחה הצעה')).toBeVisible();

  // המשתלה מאשרת
  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
  await card.getByRole('button', { name: 'אישור ההצעה' }).click();
  await expect(card).toContainText(/הוזמנה:\s*2 פעמים/);
  await expect(card).toContainText(/מחיר אחרון:.*700/);

  // מחיקה נחסמת אחרי שהמשתלה הזמינה
  await admin.goto(`${ADMIN}/admin/print-jobs`);
  await admin.getByRole('link', { name: 'משתלת E2E', exact: true }).click();
  admin.once('dialog', (d) => d.accept());
  await job.getByRole('button', { name: 'מחיקת העבודה' }).click();
  await expect(job.getByText(/כבר הזמינה מהעבודה/)).toBeVisible();
  await superCtx.close();
});
