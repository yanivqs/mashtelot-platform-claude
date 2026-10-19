import { expect, test, type Page } from './fixtures';
import { ADMIN, SHOP } from '../playwright.config';
import { E2E_OWNER } from './global-setup';

async function loginOwner(page: Page) {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

/** פותח כתובת ומחזיר את סטטוס ההפניה הראשונה (אם הייתה) ואת הכתובת הסופית. */
async function visit(page: Page, path: string) {
  const res = await page.goto(`${SHOP}${path}`);
  const from = res?.request().redirectedFrom();
  return { status: res?.status(), redirectStatus: (await from?.response())?.status(), url: page.url() };
}

test('owner adds redirects; old addresses land on the new pages (§14.01)', async ({ page }) => {
  // לפני: כתובות ישנות → 404
  expect((await visit(page, '/old-page.html')).status).toBe(404);

  await loginOwner(page);
  await page.getByRole('link', { name: 'הפניות (SEO)' }).click();

  // Open redirect נדחה, והקלט נשמר
  await page.locator('input[name="from"]').fill('/go-away');
  await page.locator('input[name="to"]').fill('//evil.example/x');
  await page.getByRole('button', { name: 'הוספת הפניה' }).click();
  await expect(page.getByText('היעד חייב להיות נתיב באתר')).toBeVisible();
  await expect(page.locator('input[name="from"]')).toHaveValue('/go-away');

  // כתובת מלאה של האתר הישן → נשמר רק הנתיב
  await page.locator('input[name="from"]').fill('https://old-site.co.il/old-page.html');
  await page.locator('input[name="to"]').fill('/catalog');
  await page.getByRole('button', { name: 'הוספת הפניה' }).click();
  await expect(page.getByText('נשמר ✓')).toBeVisible();
  await expect(page.locator('td', { hasText: '/old-page.html' })).toBeVisible();

  // יבוא CSV עם שורה שגויה
  await page.getByLabel('שורות הפניה בפורמט CSV').fill('from,to\n/shop/roses/red,/catalog\n/bad,https://evil.example');
  await page.getByRole('button', { name: 'יבוא' }).click();
  await expect(page.getByText('נשמרו 1 הפניות, 1 שורות נדחו')).toBeVisible();
  await expect(page.getByText(/שורה 3:/)).toBeVisible();

  // החנות: הפניה קבועה (308) ליעד
  const legacy = await visit(page, '/old-page.html');
  expect(legacy.redirectStatus).toBe(308);
  expect(new URL(legacy.url).pathname).toBe('/catalog');

  const deep = await visit(page, '/shop/roses/red');
  expect(deep.redirectStatus).toBe(308);
  expect(new URL(deep.url).pathname).toBe('/catalog');

  // כתובת בלי הפניה — עדיין 404
  expect((await visit(page, '/no-such-page')).status).toBe(404);

  // מונה כניסות במסך הניהול
  await page.goto(`${ADMIN}/admin/redirects`);
  await expect(page.locator('tr', { hasText: '/old-page.html' }).locator('td').nth(2)).toHaveText('1');
});

test('static files with a dot are not routed to the store', async ({ page }) => {
  const res = await page.goto(`${SHOP}/robots.txt`);
  expect(res?.status()).toBe(200);
  expect(await res?.text()).toContain('Sitemap:');
});
