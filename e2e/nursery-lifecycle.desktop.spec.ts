import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_LIFE_OWNER, E2E_SUPER6 } from './global-setup';

const LIFE = 'http://e2elife.localhost:3100';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
}

async function setStatus(page: Page, label: string, value: string) {
  await page.goto(`${ADMIN}/admin/nurseries`);
  page.once('dialog', (d) => d.accept());
  await page.getByLabel('סטטוס — משתלת מחזור חיים').selectOption(value);
  await expect(page.getByTestId('status-e2elife')).toHaveText(label);
}

test('nursery lifecycle (§2.03): suspended shows "temporarily closed", draft is not public but the owner works, active is back', async ({ page }) => {
  await page.goto(LIFE);
  await expect(page.locator('header').getByText('משתלת מחזור חיים')).toBeVisible();

  await login(page, E2E_SUPER6);
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  // מושעית — "סגורה זמנית" עם טלפון, בכל דף
  await setStatus(page, 'מושעית', 'SUSPENDED');
  await page.goto(`${LIFE}/catalog`);
  await expect(page.getByText('החנות המקוונת סגורה זמנית.')).toBeVisible();
  await expect(page.getByRole('link', { name: '03-5551234' })).toBeVisible();

  // טיוטה — החנות לא קיימת ללקוחות
  await setStatus(page, 'טיוטה (בהקמה)', 'DRAFT');
  expect((await page.goto(LIFE))?.status()).toBe(404);

  // הבעלים עובד בזמן ההקמה ורואה הודעה
  await login(page, E2E_LIFE_OWNER);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await expect(page.getByTestId('draft-banner')).toBeVisible();

  // פעילה — החנות חוזרת
  await login(page, E2E_SUPER6);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await setStatus(page, 'פעילה', 'ACTIVE');
  await page.goto(LIFE);
  await expect(page.getByText('החנות המקוונת סגורה זמנית.')).toHaveCount(0);
  await expect(page.locator('header').getByText('משתלת מחזור חיים')).toBeVisible();
});
