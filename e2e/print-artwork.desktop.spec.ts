import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER4, E2E_SAVED_TEMPLATE, E2E_SUPER3 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

const PDF = (n: number) => ({ name: `לוגו-${n}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.7\n% artwork ${n}\n`) });

test('artwork: private upload by content, proof, explicit approval of a specific version, signed downloads (PT-05/08)', async ({ page }) => {
  // הזמנה חד-פעמית מתבנית
  await login(page, E2E_OWNER4);
  await page.goto(`${ADMIN}/admin/print-shop`);
  const card = page.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: E2E_SAVED_TEMPLATE }) });
  await card.getByRole('button', { name: 'הזמנה' }).click();
  await card.getByLabel('טקסט').fill('גרפיקה E2E');
  await card.getByLabel('גודל').selectOption('s');
  await card.getByLabel(/^כמות/).fill('10');
  await card.getByRole('button', { name: 'שליחת הזמנה' }).click();
  await expect(card.getByText(/ההזמנה התקבלה ✓/)).toBeVisible();
  await page.reload();

  const order = page.locator('div.rounded-xl').filter({ hasText: 'גרפיקה E2E' }).filter({ has: page.getByText('גרפיקה', { exact: true }) }).first();
  // SVG שמתחזה ל-PDF — נדחה לפי התוכן
  await order.getByLabel('העלאת קובץ גרפיקה').setInputFiles({ name: 'evil.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(order.getByText(/סוג קובץ לא נתמך/)).toBeVisible();

  await order.getByLabel('העלאת קובץ גרפיקה').setInputFiles(PDF(1));
  await expect(order.getByText('ממתין להגהה מבית הדפוס')).toBeVisible();
  const fileLink = order.getByRole('link', { name: 'לוגו-1.pdf' });
  const fileUrl = await fileLink.getAttribute('href');
  const dl = await page.request.get(`${ADMIN}${fileUrl}`);
  expect(dl.status()).toBe(200);
  expect(dl.headers()['content-type']).toBe('application/pdf');
  expect(dl.headers()['content-disposition']).toContain('attachment');
  expect((await dl.body()).toString()).toContain('artwork 1');

  // בית הדפוס מעלה הגהה
  await login(page, E2E_SUPER3);
  await page.getByRole('link', { name: /גרפיקה והגהות \(\d+\)/ }).click();
  const row = page.locator('section').filter({ hasText: E2E_SAVED_TEMPLATE }).filter({ hasText: 'לוגו-1.pdf' }).first();
  await row.getByLabel('העלאת הגהה').setInputFiles({ name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n% proof\n') });
  await expect(row.getByText('ממתין לאישור המשתלה')).toBeVisible();

  // הקישור החתום לא עובד בלי התחברות
  await page.context().clearCookies();
  expect((await page.request.get(`${ADMIN}${fileUrl}`)).status()).toBe(401);

  // המשתלה מורידה את ההגהה ומאשרת את הגרסה הזו
  await login(page, E2E_OWNER4);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await expect(order.getByText('הגהה ממתינה לאישורכם')).toBeVisible();
  const proofUrl = await order.getByRole('link', { name: 'הורדת ההגהה' }).getAttribute('href');
  expect((await (await page.request.get(`${ADMIN}${proofUrl}`)).body()).toString()).toContain('% proof');
  await order.getByRole('button', { name: 'אישור ההגהה לדפוס' }).click();
  await expect(order.getByText('מאושר לדפוס')).toBeVisible();
  await expect(order.getByText(/אושר במערכת/)).toBeVisible();

  // גרסה חדשה מבטלת את האישור הקודם
  await order.getByLabel('העלאת גרסה חדשה').setInputFiles(PDF(2));
  await expect(order.getByText('הוחלף בגרסה חדשה')).toBeVisible();
  await expect(order.getByText('ממתין להגהה מבית הדפוס')).toBeVisible();
});
