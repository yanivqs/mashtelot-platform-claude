import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER8 } from './global-setup';

test('admin form keeps typed values after a server error, and resets after success (UX-01)', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER8.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER8.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.goto(`${ADMIN}/admin/marketing`);

  // שגיאת שרת (תאריך התחלה אחרי הסיום) — כל מה שהוקלד נשאר
  await page.locator('input[name="code"]').fill('ux01keep');
  await page.locator('input[name="discountPct"]').fill('15');
  await page.locator('input[name="startsAt"]').fill('2030-05-10');
  await page.locator('input[name="endsAt"]').fill('2030-05-01');
  await page.locator('input[name="usageLimit"]').fill('7');
  await page.getByRole('button', { name: 'הוספת קופון' }).click();
  await expect(page.getByText('תאריך תחילת התוקף חייב להיות לפני תאריך הסיום')).toBeVisible();
  await expect(page.locator('input[name="code"]')).toHaveValue('ux01keep');
  await expect(page.locator('input[name="discountPct"]')).toHaveValue('15');
  await expect(page.locator('input[name="startsAt"]')).toHaveValue('2030-05-10');
  await expect(page.locator('input[name="usageLimit"]')).toHaveValue('7');

  // תיקון שדה אחד בלבד ושמירה — הצלחה, והטופס מתאפס כרגיל
  await page.locator('input[name="endsAt"]').fill('2030-06-01');
  await page.getByRole('button', { name: 'הוספת קופון' }).click();
  await expect(page.getByText('נוסף ✓')).toBeVisible();
  await expect(page.getByText('UX01KEEP')).toBeVisible();
  await expect(page.locator('input[name="code"]')).toHaveValue('');
});
