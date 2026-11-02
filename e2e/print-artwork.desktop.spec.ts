import AxeBuilder from '@axe-core/playwright';
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
/** PDF תקין שדפדפן מסוגל לרנדר, לבדיקת התמונה הקטנה */
const REAL_PDF = {
  name: 'אמיתי.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n'),
};
const PNG = {
  name: 'תמונה.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'),
};

async function openCalculator(page: Page, text: string) {
  await page.goto(`${ADMIN}/admin/print-shop`);
  await page.getByRole('link', { name: new RegExp(E2E_SAVED_TEMPLATE) }).click();
  await page.getByLabel('טקסט').fill(text);
  await page.getByLabel(/^גודל/).selectOption('s');
  await page.getByLabel('כמות').fill('10');
}

test('artwork: upload in the calculator checked by content, proof, explicit approval of a specific version, signed downloads', async ({ page }) => {
  await login(page, E2E_OWNER4);
  await openCalculator(page, 'גרפיקה E2E');

  // SVG שמתחזה ל-PDF נדחה לפי התוכן
  await page.getByLabel('העלאת קובץ').setInputFiles({ name: 'evil.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByText(/סוג קובץ לא נתמך/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'קבלת מחיר והזמנה' })).toBeDisabled();

  await page.getByLabel('העלאת קובץ').setInputFiles(PDF(1));
  await expect(page.getByTestId('print-file')).toContainText('לוגו-1.pdf');
  await expect(page.getByTestId('print-file')).toContainText('לבדיקה ידנית');
  await page.getByRole('button', { name: 'קבלת מחיר והזמנה' }).click();
  await expect(page.getByTestId('print-confirmation')).toContainText('ההזמנה התקבלה');

  await page.getByRole('link', { name: 'לעבודות שלי' }).click();
  const order = page.getByTestId('job-card').filter({ hasText: 'גרפיקה E2E' });
  await order.getByRole('button', { name: 'קובץ והגהות' }).click();
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

  // המשתלה מורידה את ההגהה ומאשרת את הגרסה הזו. הפאנל נפתח לבד כשיש הגהה שממתינה
  await login(page, E2E_OWNER4);
  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
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

test('thumbnails: PNG and a real PDF render in the job card, under the live CSP, and stay private', async ({ page, browser }) => {
  const csp: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) csp.push(m.text());
  });
  await login(page, E2E_OWNER4);

  for (const [text, file] of [['תמונה E2E', PNG], ['מסמך E2E', REAL_PDF]] as const) {
    await openCalculator(page, text);
    await page.getByLabel('העלאת קובץ').setInputFiles(file);
    const img = page.getByTestId('print-file').locator('img');
    await expect(img).toBeVisible({ timeout: 20000 });
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'קבלת מחיר והזמנה' }).click();
    await expect(page.getByTestId('print-confirmation')).toBeVisible();
  }

  await page.goto(`${ADMIN}/admin/print-shop/jobs`);
  const img = page.getByTestId('job-card').filter({ hasText: 'מסמך E2E' }).locator('img');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  const src = (await img.getAttribute('src'))!;
  expect(src).toContain('/thumbnail');
  const res = await page.request.get(`${ADMIN}${src}`);
  expect(res.headers()['content-type']).toBe('image/jpeg');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');

  // בלי התחברות אין גישה לתמונה
  const anon = await browser.newContext();
  expect((await anon.request.get(`${ADMIN}${src}`)).status()).toBe(401);
  await anon.close();
  expect(csp).toEqual([]);

  // נגישות בתוכן של המסכים החדשים
  const problems: string[] = [];
  for (const path of ['/admin/print-shop', '/admin/print-shop/jobs']) {
    await page.goto(`${ADMIN}${path}`);
    const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const v of violations) problems.push(`${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  }
  await page.goto(`${ADMIN}/admin/print-shop`);
  await page.getByRole('link', { name: new RegExp(E2E_SAVED_TEMPLATE) }).click();
  await expect(page.getByTestId('print-missing')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  for (const v of violations) problems.push(`product ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(problems).toEqual([]);

  // כתובת מוצר שלא קיימת: "לא נמצא" ודרך חזרה
  await page.goto(`${ADMIN}/admin/print-shop/no-such-product`);
  await expect(page.getByRole('heading', { name: 'המוצר לא נמצא' })).toBeVisible();
  await page.getByRole('link', { name: 'לקטלוג מוצרי הדפוס' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin/print-shop`);
});
