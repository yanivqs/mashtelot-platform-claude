import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { SHOP } from '../playwright.config';
import { hashOtp } from '../lib/customer-otp';

const EMAIL = `buyer-${Date.now()}@e2e.invalid`;
const CODE = '246810';

test('customer account (R06-03): email code login, guest orders claimed, profile, checkout prefill and link', async ({ page }) => {
  const db = new PrismaClient({ log: [] });
  try {
    const n = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eshop' } });
    // הזמנה קודמת כאורח עם אותו מייל
    await db.order.create({ data: { nurseryId: n.id, customerName: 'אורח', customerEmail: EMAIL, customerPhone: '050', totalAmount: '12.00', stockState: 'NONE' } });

    await page.goto(`${SHOP}/`);
    await page.locator('header').getByRole('link', { name: 'החשבון שלי' }).first().click();
    await expect(page.getByRole('heading', { name: 'כניסה לחשבון' })).toBeVisible();
    await page.getByLabel('אימייל').fill(EMAIL);
    await page.getByRole('button', { name: 'שליחת קוד' }).click();
    await expect(page.getByText(/שלחנו קוד בן 6 ספרות/)).toBeVisible();

    // במקום תיבת דואר: מחליפים את הקוד שנשלח בקוד ידוע (אותו HMAC כמו בשרת)
    const otp = await db.customerOtp.findFirstOrThrow({ where: { nurseryId: n.id, email: EMAIL, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    await db.customerOtp.update({ where: { id: otp.id }, data: { codeHash: hashOtp(n.id, EMAIL, CODE) } });

    await page.getByLabel('קוד').fill('000000');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByText(/הקוד שגוי או שפג תוקפו/)).toBeVisible();
    await page.getByLabel('קוד').fill(CODE);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByRole('heading', { name: 'החשבון שלי' })).toBeVisible();
    await expect(page.getByTestId('order-count')).toHaveText('1 הזמנות משויכות לחשבון.');

    // פרופיל + הסכמה לדיוור
    await page.getByLabel('שם מלא').fill('דנה לקוחה');
    await page.getByLabel('טלפון').fill('050-1234567');
    await page.getByLabel(/לקבל עדכונים ומבצעים/).check();
    await page.getByRole('button', { name: 'שמירה' }).click();
    await expect(page.getByText('נשמר ✓')).toBeVisible();
    const c = await db.customer.findFirstOrThrow({ where: { nurseryId: n.id, email: EMAIL } });
    expect(c).toMatchObject({ fullName: 'דנה לקוחה', phone: '050-1234567' });
    expect(c.marketingConsentAt).not.toBeNull();

    // קופה: מילוי מראש, וההזמנה משויכת לחשבון
    await page.goto(`${SHOP}/catalog`);
    await page.locator('article, li, div').filter({ hasText: 'ריחן מתוק' }).getByRole('button', { name: 'הוסף לעגלה' }).first().click();
    await page.goto(`${SHOP}/checkout`);
    await expect(page.getByText('מחובר/ת לחשבון — הפרטים מולאו מראש.')).toBeVisible();
    await expect(page.locator('input[name="customerName"]')).toHaveValue('דנה לקוחה');
    await expect(page.locator('input[name="customerEmail"]')).toHaveValue(EMAIL);
    await page.locator('label', { hasText: 'איסוף עצמי מהמשתלה' }).click();
    await page.getByRole('button', { name: /שליחת ההזמנה|סיום|הזמנה/ }).click();
    await expect(page).toHaveURL(/\/checkout\/success\//);
    expect(await db.order.count({ where: { nurseryId: n.id, customerId: c.id } })).toBe(2);

    // יציאה
    await page.goto(`${SHOP}/account`);
    await page.getByRole('button', { name: 'יציאה', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'כניסה לחשבון' })).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
