import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER3, E2E_SAVED_TEMPLATE, E2E_SUPER2 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

const TEXT = 'משתלת הדר';

test('review path: design request → spec rejected → similar order → approved → design → quote → nursery approves → reorder', async ({ page }) => {
  // המשתלה מבקשת עיצוב: עובר לבדיקת צוות
  await login(page, E2E_OWNER3);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await page.getByRole('link', { name: new RegExp(E2E_SAVED_TEMPLATE) }).click();
  await page.getByLabel('טקסט').fill(TEXT);
  await page.getByLabel(/^גודל/).selectOption('s');
  await page.getByLabel('כמות').fill('10');
  await expect(page.getByTestId('print-missing')).toContainText('יש להעלות קובץ');
  await page.getByText('אין לי קובץ, אני צריך גם עיצוב').click();
  await expect(page.getByTestId('print-review')).toContainText('נדרש עיצוב');
  await page.getByRole('button', { name: 'שליחה לבדיקה' }).click();
  await expect(page.getByTestId('print-confirmation')).toContainText('נדרש עיצוב');

  await page.getByRole('link', { name: 'לעבודות שלי' }).click();
  const jobs = page.getByTestId('job-card').filter({ hasText: `טקסט: ${TEXT}` });
  await expect(jobs).toHaveCount(1);
  await expect(jobs).toContainText('המפרט ממתין לאישור בית הדפוס');
  await expect(jobs.getByRole('button', { name: 'הזמן שוב' })).toHaveCount(0);

  // בית הדפוס דוחה עם הערה
  await login(page, E2E_SUPER2);
  await page.goto(`${ADMIN}/admin/print-specs`);
  const req = page.locator('section').filter({ hasText: TEXT }).first();
  await req.getByRole('button', { name: 'דחייה' }).click();
  await expect(req.getByText('בדחייה יש לכתוב למשתלה מה לתקן')).toBeVisible();
  await req.getByLabel('הערה למשתלה').fill('נא להגדיל את המדבקה');
  await req.getByRole('button', { name: 'דחייה' }).click();
  await expect(page.getByText('אין בקשות ממתינות')).toBeVisible();

  // המשתלה רואה את ההערה ומזמינה "הזמנה דומה" עם הערכים ממולאים
  await login(page, E2E_OWNER3);
  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
  await expect(jobs).toContainText('הערת בית הדפוס: נא להגדיל את המדבקה');
  await jobs.getByRole('link', { name: 'הזמנה דומה' }).click();
  await expect(page.getByLabel('טקסט')).toHaveValue(TEXT);
  await page.getByLabel(/^גודל/).selectOption('l');
  await page.getByText('אין לי קובץ, אני צריך גם עיצוב').click();
  await page.getByRole('button', { name: 'שליחה לבדיקה' }).click();
  await expect(page.getByTestId('print-confirmation')).toBeVisible();

  // בית הדפוס: אישור מפרט, העלאת עיצוב, שליחת הצעה
  await login(page, E2E_SUPER2);
  await page.goto(`${ADMIN}/admin/print-specs`);
  await page.locator('section').filter({ hasText: TEXT }).filter({ hasText: 'גדול' }).first().getByRole('button', { name: 'אישור המפרט' }).click();
  await expect(page.getByText('אין בקשות ממתינות')).toBeVisible();

  await page.goto(`${ADMIN}/admin/print-artwork`);
  const design = page.getByTestId('awaiting-design').filter({ hasText: 'גדול' });
  await design.getByLabel('העלאת עיצוב').setInputFiles({ name: 'design.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n% design\n') });
  await expect(page.locator('section').filter({ hasText: 'design.pdf' }).first()).toBeVisible();
  await expect(page.getByTestId('awaiting-design').filter({ hasText: 'גדול' })).toHaveCount(0);

  await page.goto(`${ADMIN}/admin/print-orders`);
  const panel = page.locator('div.rounded-xl').filter({ hasText: `גודל: גדול` }).filter({ hasText: TEXT }).getByTestId('quote-panel').first();
  await panel.getByLabel('הערות פנימיות').fill('ללקוח ותיק');
  await panel.getByRole('button', { name: 'סימון בטיפול' }).click();
  await expect(panel.getByText('בטיפול', { exact: true })).toBeVisible();
  await panel.getByLabel('מחיר כולל להצעה').fill('300');
  await panel.getByLabel('תוקף ההצעה').fill('2099-12-31');
  await panel.getByRole('button', { name: 'שליחת הצעה למשתלה' }).click();
  await expect(panel.getByText('נשלחה הצעה')).toBeVisible();

  // המשתלה מאשרת את ההצעה מ"העבודות שלי"; הערות פנימיות לא מוצגות לה
  await login(page, E2E_OWNER3);
  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
  const job = jobs.filter({ hasText: 'גודל: גדול' });
  await expect(job.getByTestId('quote-offer')).toContainText('300');
  await expect(job.getByTestId('quote-offer')).toContainText('בתוקף עד');
  await expect(page.getByText('ללקוח ותיק')).toHaveCount(0);
  await job.getByRole('button', { name: 'אישור ההצעה' }).click();
  await expect(job.getByTestId('quote-offer')).toHaveCount(0);
  await expect(job).toContainText('התקבלה');
  await expect(job).toContainText(/מחיר אחרון:.*300/);

  // הזמנה חוזרת: המפרט מאושר. (2 + גדול 1) × 20 = 60
  await job.getByRole('button', { name: 'הזמן שוב' }).click();
  await job.getByLabel('כמות').fill('20');
  await expect(job.getByTestId('reorder-price')).toContainText('60');
  await expect(job.getByTestId('reorder-price')).toContainText(/בהזמנה האחרונה:.*300/);
  await job.getByRole('button', { name: 'שליחת הזמנה' }).click();
  await expect(job.getByText(/ההזמנה התקבלה ✓/)).toBeVisible();

  // הסרה מהרשימה
  const rejected = jobs.filter({ hasText: 'גודל: קטן' });
  await expect(rejected).toContainText('בוטלה');
  await rejected.getByRole('button', { name: 'הסרה מהרשימה' }).click();
  await expect(rejected).toHaveCount(0);
});
