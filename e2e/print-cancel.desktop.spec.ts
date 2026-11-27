import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_CANCEL_JOBS, E2E_CANCEL_OWNER, E2E_SUPER12 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

test('print orders: the nursery cancels before production; the print house sees it and deletes an order for good', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const jobCard = (name: string) => page.getByTestId('job-card').filter({ has: page.getByRole('heading', { name }) });
  const orderCard = (name: string) => page.getByTestId('print-order-card').filter({ hasText: name });

  // בעל המשתלה מבטל הזמנה שעוד לא בייצור — העבודה יורדת מהרשימה שלו
  await login(page, E2E_CANCEL_OWNER);
  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
  await expect(jobCard(E2E_CANCEL_JOBS.cancel)).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  await jobCard(E2E_CANCEL_JOBS.cancel).getByTestId('cancel-print-order').click();
  await expect(jobCard(E2E_CANCEL_JOBS.cancel)).toHaveCount(0);
  await expect(jobCard(E2E_CANCEL_JOBS.remove)).toBeVisible();

  // בית הדפוס רואה "בוטלה ע"י המשתלה", ומוחק לצמיתות את ההזמנה השנייה
  await login(page, E2E_SUPER12);
  await page.goto(`${ADMIN}/admin/print-orders`);
  await expect(orderCard(E2E_CANCEL_JOBS.cancel).getByTestId('cancelled-by-nursery')).toBeVisible();
  await expect(orderCard(E2E_CANCEL_JOBS.remove).getByTestId('cancelled-by-nursery')).toHaveCount(0);
  await orderCard(E2E_CANCEL_JOBS.remove).getByTestId('delete-print-order').click();
  await expect(orderCard(E2E_CANCEL_JOBS.remove)).toHaveCount(0);

  // ...והיא נעלמה גם אצל המשתלה
  await login(page, E2E_CANCEL_OWNER);
  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
  await expect(jobCard(E2E_CANCEL_JOBS.remove)).toHaveCount(0);
});
