import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_SUPER7 } from './global-setup';

const OWNER = { email: 'acct-owner@e2e.invalid', password: 'e2e-acct-owner-pass-123' };
const STORE = 'http://e2eacct.localhost:3100';
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

async function setup() {
  const db = new PrismaClient({ log: [] });
  try {
    await db.user.deleteMany({ where: { email: OWNER.email } });
    await db.nursery.deleteMany({ where: { subdomain: 'e2eacct' } });
    const n = await db.nursery.create({
      data: {
        name: 'משתלת חשבון E2E',
        subdomain: 'e2eacct',
        ownerEmail: OWNER.email,
        users: { create: { email: OWNER.email, role: 'NURSERY_OWNER', passwordHash: await bcrypt.hash(OWNER.password, 4) } },
        nurseryProducts: { create: { customTitle: 'שתיל לבדיקת חשבון', price: '10.00', stockQuantity: 3 } },
      },
    });
    return n.id;
  } finally {
    await db.$disconnect();
  }
}

test('account: modules, fees, warning, block with the store open, payment, suspension', async ({ page, browser }) => {
  test.setTimeout(120000);
  const nurseryId = await setup();
  const superCtx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '10.77.0.1' } });
  const admin = await superCtx.newPage();
  await login(admin, E2E_SUPER7);

  // בסיס תמיד פעיל, תוספות כבויות עד שמדליקים
  await login(page, OWNER);
  const nav = page.getByRole('navigation').first();
  const labels = await nav.getByRole('link').allInnerTexts();
  expect(labels.map((l) => l.trim()).slice(0, 10)).toEqual(['סקירה', 'המלאי שלי', 'שיוך מוצרים', 'הקטגוריות שלי', 'הזמנות', 'הפניות SEO', 'הגדרות משתלה', 'בית דפוס', 'יומן פעילות', 'עדכונים מהקטלוג']);
  for (const off of ['שיווק', 'בלוג', 'עמודים', 'לקוחות', 'צוות', 'עיצוב דף הבית']) await expect(nav.getByRole('link', { name: off, exact: true })).toHaveCount(0);
  await page.goto(`${ADMIN}/admin/marketing`);
  await expect(page).toHaveURL(/notice=MODULE_DISABLED/);
  await page.goto(`${ADMIN}/admin/settings`);
  await expect(page.getByRole('heading', { name: 'אפשרויות תשלום' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'איסוף עצמי ומשלוחים' })).toHaveCount(0);

  // סופר-אדמין: מודולים ועלויות
  await admin.goto(`${ADMIN}/admin/accounts`);
  await admin.getByRole('link', { name: 'משתלת חשבון E2E' }).click();
  await admin.getByLabel('עלות הקמה: מערכת בסיס').fill('500');
  await admin.getByLabel('עלות חודשית: מערכת בסיס').fill('100');
  await admin.getByLabel('קופונים', { exact: true }).check();
  await admin.getByLabel('עלות הקמה: קופונים').fill('50');
  await admin.getByLabel('עלות חודשית: קופונים').fill('20');
  await admin.getByLabel('אפשרויות תשלום', { exact: true }).check();
  await expect(admin.getByTestId('account-totals')).toContainText('550');
  await expect(admin.getByTestId('account-totals')).toContainText('120');

  // מועדון לקוחות דורש חשבונות לקוח
  await admin.getByLabel('מועדון לקוחות', { exact: true }).check();
  await admin.getByRole('button', { name: 'שמירת החשבון' }).click();
  await expect(admin.getByText(/דורש גם את "חשבונות לקוח"/)).toBeVisible();
  await admin.getByLabel('מועדון לקוחות', { exact: true }).uncheck();

  await admin.locator('select[name="billingType"]').selectOption('MONTHLY');
  await admin.locator('input[name="billingDate"]').fill(daysFromNow(-2));
  await admin.getByRole('button', { name: 'מילוי: חודשי' }).click();
  await expect(admin.locator('input[name="amountDue"]')).toHaveValue('120.00');
  await admin.locator('select[name="paymentMethod"]').selectOption('TRANSFER');
  await admin.getByRole('button', { name: 'שמירת החשבון' }).click();
  await expect(admin.getByText('נשמר ✓')).toBeVisible();

  // בעל המשתלה: רואה רק את החלק שנדלק, ואזהרה בימי החסד
  await page.goto(`${ADMIN}/admin/marketing`);
  await expect(page.getByRole('heading', { name: 'קופונים' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'פופאפים' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /הודעת סטיקי/ })).toHaveCount(0);
  await expect(page.getByTestId('account-warning')).toContainText('הגישה לניהול תיחסם');
  await page.goto(`${ADMIN}/admin/settings`);
  await expect(page.getByRole('heading', { name: 'אפשרויות תשלום' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'איסוף עצמי ומשלוחים' })).toHaveCount(0);

  // עבר מועד החיוב + 3 ימי חסד: נחסם, והחנות נשארת פתוחה
  await admin.locator('input[name="billingDate"]').fill(daysFromNow(-5));
  await admin.getByRole('button', { name: 'שמירת החשבון' }).click();
  await expect(admin.getByText('נשמר ✓')).toBeVisible();
  await admin.getByRole('link', { name: 'לכל החשבונות' }).click();
  await expect(admin.locator('tr', { hasText: 'משתלת חשבון E2E' }).getByTestId('account-status')).toHaveText('חסום');

  for (const path of ['/admin', '/admin/products', '/admin/orders', '/admin/settings', '/admin/print-shop']) {
    await page.goto(`${ADMIN}${path}`);
    await expect(page).toHaveURL(`${ADMIN}/admin/account-blocked`);
  }
  await expect(page.getByTestId('account-blocked')).toContainText('עבר מועד החיוב');
  await expect(page.getByTestId('account-blocked')).toContainText('hello@mashtelot.net');
  await expect(page.getByRole('navigation').first().getByRole('link')).toHaveCount(0);
  expect((await page.goto(`${STORE}/catalog`))!.status()).toBe(200);
  await expect(page.getByText('שתיל לבדיקת חשבון').first()).toBeVisible();

  // סומן כשולם: התאריך מתקדם והגישה חוזרת
  await admin.getByRole('link', { name: 'משתלת חשבון E2E' }).click();
  await admin.getByRole('button', { name: 'סומן כשולם' }).click();
  await expect(admin.getByText('התשלום נרשם ✓')).toBeVisible();
  await page.goto(`${ADMIN}/admin/products`);
  await expect(page).toHaveURL(`${ADMIN}/admin/products`);

  // השהיה: הסיבה ופרטי הקשר בלבד. בפרטי הקשר מופיע הטלפון שהוגדר
  await admin.goto(`${ADMIN}/admin/accounts`);
  await admin.locator('input[name="contactPhone"]').fill('050-0000000');
  await admin.getByRole('button', { name: 'שמירת פרטי קשר' }).click();
  await expect(admin.getByText('נשמר ✓')).toBeVisible();
  await admin.getByRole('link', { name: 'משתלת חשבון E2E' }).click();
  await admin.locator('input[name="reason"]').fill('חוב פתוח מהחודש שעבר');
  await admin.getByRole('button', { name: 'השהיית החשבון' }).click();
  await expect(admin.getByText(/החשבון מושהה/)).toBeVisible();
  await page.goto(`${ADMIN}/admin/products`);
  await expect(page).toHaveURL(`${ADMIN}/admin/account-blocked`);
  await expect(page.getByTestId('account-blocked')).toContainText('חוב פתוח מהחודש שעבר');
  await expect(page.getByTestId('account-blocked')).toContainText('050-0000000');
  expect((await page.goto(`${STORE}/`))!.status()).toBe(200);
  await admin.getByRole('button', { name: 'חידוש החשבון' }).click();
  await expect(admin.getByRole('button', { name: 'השהיית החשבון' })).toBeVisible();
  await page.goto(`${ADMIN}/admin/products`);
  await expect(page).toHaveURL(`${ADMIN}/admin/products`);

  // מוצרים: שכפול ומחיקה מהרשימה
  await page.getByRole('button', { name: 'שכפול שתיל לבדיקת חשבון' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}/);
  await page.goto(`${ADMIN}/admin/products`);
  await expect(page.getByRole('link', { name: 'שתיל לבדיקת חשבון (עותק)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'הצגת שתיל לבדיקת חשבון (עותק)' }).first()).toBeVisible();
  await page.goto(`${STORE}/catalog`);
  await expect(page.getByText('(עותק)')).toHaveCount(0);

  await page.goto(`${ADMIN}/admin/products`);
  // ביטול באישור לא מוחק
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'מחיקת שתיל לבדיקת חשבון (עותק)' }).click();
  await expect(page.getByRole('link', { name: 'שתיל לבדיקת חשבון (עותק)' })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'מחיקת שתיל לבדיקת חשבון (עותק)' }).click();
  await expect(page.getByRole('link', { name: 'שתיל לבדיקת חשבון (עותק)' })).toHaveCount(0);

  await superCtx.close();
  const db = new PrismaClient({ log: [] });
  await db.user.deleteMany({ where: { email: OWNER.email } });
  await db.nursery.delete({ where: { id: nurseryId } });
  await db.platformSettings.deleteMany();
  await db.$disconnect();
});
