import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_FLOAT_OWNER, FLOAT_SHOP } from './global-setup';

test('owner edits the announcement bar in the admin and the store shows it', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_FLOAT_OWNER.email);
  await page.locator('input[name="password"]').fill(E2E_FLOAT_OWNER.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  await page.goto(`${ADMIN}/admin/marketing`);
  const form = page.locator('form').filter({ has: page.locator('input[name="linkText"]') });
  // קישור לא בטוח — נדחה, והטקסט שהוקלד נשמר
  await form.locator('input[name="text"]').fill('מבצע סוף שבוע');
  await form.locator('input[name="href"]').fill('javascript:alert(1)');
  await form.getByRole('button', { name: 'שמירת ההודעה' }).click();
  await expect(form.getByText(/קישור לא תקין/)).toBeVisible();
  await expect(form.locator('input[name="text"]')).toHaveValue('מבצע סוף שבוע');

  await form.locator('select').nth(1).selectOption({ label: 'קטגוריה: מוצרי גינון' });
  await expect(form.locator('input[name="href"]')).toHaveValue('/catalog?category=e2e-garden');
  await form.locator('input[name="linkText"]').fill('לעציצים');
  await form.getByRole('button', { name: 'שמירת ההודעה' }).click();
  await expect(form.getByText('נשמר ✓')).toBeVisible();

  await page.goto(`${FLOAT_SHOP}/`);
  const bar = page.getByTestId('announcement-bar');
  await expect(bar).toContainText('מבצע סוף שבוע');
  await expect(bar.getByRole('link')).toHaveAttribute('href', '/catalog?category=e2e-garden');
});
