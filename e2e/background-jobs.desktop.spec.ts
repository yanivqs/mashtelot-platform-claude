import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_SUPER3 } from './global-setup';

const AUTH = { authorization: `Bearer ${process.env.CRON_SECRET}` };

test('background jobs (§21): cron routes require the secret, run, and show in the system screen', async ({ page, request }) => {
  expect((await request.get(`${ADMIN}/api/cron/emails`)).status()).toBe(401);
  expect((await request.get(`${ADMIN}/api/cron/emails`, { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
  expect((await request.get(`${ADMIN}/api/cron/nope`, { headers: AUTH })).status()).toBe(404);
  for (const job of ['reservations', 'emails', 'cleanup']) {
    const res = await request.get(`${ADMIN}/api/cron/${job}`, { headers: AUTH });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  }

  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_SUPER3.email);
  await page.locator('input[name="password"]').fill(E2E_SUPER3.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.goto(`${ADMIN}/admin/system`);
  const jobs = page.getByTestId('jobs');
  await expect(jobs.getByText('מופעלות אוטומטית ב-Vercel Cron.', { exact: false })).toBeVisible();
  for (const label of ['שחרור שמירות מלאי שפגו', 'שליחה חוזרת של מיילים', 'ניקוי נתונים זמניים']) {
    await expect(jobs.locator('li').filter({ hasText: label }).getByText(/ריצה אחרונה/)).toBeVisible();
  }
});
