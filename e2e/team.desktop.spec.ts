import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER6 } from './global-setup';

const STAFF = { email: 'staff@e2e.invalid', password: 'e2e-staff-pass-123' };
const WRITER = { email: 'writer@e2e.invalid', password: 'e2e-writer-pass-123' };

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
}

async function addMember(page: Page, m: { email: string; password: string }, role: string) {
  await page.getByLabel('אימייל (שם משתמש)').fill(m.email);
  await page.locator('select[name="role"]').first().selectOption(role);
  await page.locator('input[name="password"]').first().fill(m.password);
  await page.getByRole('button', { name: 'הוספת עובד' }).click();
  await expect(page.getByText(/נוסף ✓/)).toBeVisible();
}

test('team (R06-01): owner adds an employee and a content writer; each sees only what the role allows; disabling cuts off', async ({ page }) => {
  await login(page, E2E_OWNER6);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.getByRole('link', { name: 'צוות' }).click();
  await expect(page.getByRole('heading', { name: 'צוות', exact: true })).toBeVisible();

  // סיסמה קצרה — שגיאה, והאימייל נשמר (UX-01)
  await page.getByLabel('אימייל (שם משתמש)').fill(WRITER.email);
  const pw = page.locator('input[name="password"]').first();
  await pw.fill('short-pass');
  // עוקפים את בדיקת הדפדפן — כדי לבדוק את האכיפה בשרת
  await pw.evaluate((el) => el.removeAttribute('minlength'));
  await page.getByRole('button', { name: 'הוספת עובד' }).click();
  await expect(page.getByText(/לפחות 12 תווים/)).toBeVisible();
  await expect(page.getByLabel('אימייל (שם משתמש)')).toHaveValue(WRITER.email);

  await addMember(page, WRITER, 'NURSERY_WRITER');
  await addMember(page, STAFF, 'NURSERY_STAFF');
  await expect(page.getByTestId('team-member')).toHaveCount(2);

  // כותב תוכן: רק עמודים ובלוג
  await login(page, WRITER);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await expect(page.getByText('כותב תוכן — יש לך גישה לעריכת התוכן של האתר.')).toBeVisible();
  const nav = page.locator('aside nav');
  await expect(nav.getByRole('link', { name: 'בלוג' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'עמודים' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'הזמנות' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'החשבון שלי' })).toHaveCount(0);
  await page.goto(`${ADMIN}/admin/blog`);
  await expect(page.getByRole('heading', { name: 'בלוג', exact: true })).toBeVisible();
  // גישה ישירה לכתובת אסורה — נחסמת בשרת
  await page.goto(`${ADMIN}/admin/orders`);
  await expect(page).toHaveURL(/notice=ROLE_FORBIDDEN/);
  await expect(page.getByText('אין לך הרשאה למסך זה')).toBeVisible();
  await page.goto(`${ADMIN}/admin/account`);
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  // עובד: הכל חוץ מצוות ו"החשבון שלי"
  await login(page, STAFF);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await expect(page.locator('aside').getByText('עובד', { exact: true })).toBeVisible();
  await page.goto(`${ADMIN}/admin/orders`);
  await expect(page.getByRole('heading', { name: 'הזמנות', exact: true })).toBeVisible();
  await page.goto(`${ADMIN}/admin/settings`);
  await expect(page.getByRole('heading', { name: 'הגדרות המשתלה' })).toBeVisible();
  await expect(page.locator('aside nav').getByRole('link', { name: 'צוות' })).toHaveCount(0);
  await page.goto(`${ADMIN}/admin/team`);
  await expect(page).toHaveURL(/notice=ROLE_FORBIDDEN/);
  await page.goto(`${ADMIN}/admin/account`);
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  // בעל המשתלה משבית את העובד → לא יכול להתחבר
  await login(page, E2E_OWNER6);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.goto(`${ADMIN}/admin/team`);
  const row = page.getByTestId('team-member').filter({ hasText: STAFF.email });
  await row.getByRole('button', { name: 'השבתה' }).click();
  await expect(row.getByText('מושבת')).toBeVisible();
  await login(page, STAFF);
  await expect(page.getByText('החשבון הושבת. לפרטים פנו לבעל המשתלה.')).toBeVisible();
});
