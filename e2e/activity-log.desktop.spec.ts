import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER7, E2E_SUPER6 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

test('activity log (§20.02): settings change is audited; owner sees own nursery, super admin filters by nursery', async ({ page }) => {
  const note = `הערת משלוח ${Date.now()}`;
  await login(page, E2E_OWNER7);
  await page.goto(`${ADMIN}/admin/settings`);
  await page.getByLabel('הערה ללקוח על משלוחים (אופציונלי)').fill(note);
  const form = page.locator('form').filter({ has: page.getByLabel('הערה ללקוח על משלוחים (אופציונלי)') });
  await form.getByRole('button', { name: 'שמירה' }).click();
  await expect(form.getByText('נשמר ✓')).toBeVisible();

  // בעל המשתלה: "יומן פעולות" בתפריט, סינון "הגדרות"
  await page.locator('aside nav').getByRole('link', { name: 'יומן פעולות' }).click();
  await page.getByLabel('תחום').selectOption('settings');
  await page.getByRole('button', { name: 'סינון' }).click();
  const row = page.getByTestId('activity-row').filter({ hasText: 'delivery_settings.updated' }).filter({ hasText: E2E_OWNER7.email });
  await expect(row.first()).toBeVisible();
  // אין עמודת "משתלה" לבעל המשתלה — רק הנתונים שלו
  await expect(page.getByRole('columnheader', { name: 'משתלה' })).toHaveCount(0);

  // סופר-אדמין: כל הפלטפורמה + סינון לפי משתלה
  await login(page, E2E_SUPER6);
  await page.goto(`${ADMIN}/admin/activity`);
  await page.getByLabel('משתלה').selectOption({ label: 'משתלת E2E' });
  await page.getByLabel('מבצע').fill(E2E_OWNER7.email);
  await page.getByRole('button', { name: 'סינון' }).click();
  await expect(page.getByTestId('activity-row').filter({ hasText: 'delivery_settings.updated' }).first()).toBeVisible();
});
