import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { SHOP } from '../playwright.config';
import { hashOtp } from '../lib/customer-otp';

const EMAIL = `portal-${Date.now()}@e2e.invalid`;
const CODE = '135790';

async function customerLogin(page: Page, db: PrismaClient, nurseryId: string) {
  await page.goto(`${SHOP}/account`);
  await page.getByLabel('אימייל').fill(EMAIL);
  await page.getByRole('button', { name: 'שליחת קוד' }).click();
  await expect(page.getByText(/שלחנו קוד/)).toBeVisible();
  const otp = await db.customerOtp.findFirstOrThrow({ where: { nurseryId, email: EMAIL, consumedAt: null }, orderBy: { createdAt: 'desc' } });
  await db.customerOtp.update({ where: { id: otp.id }, data: { codeHash: hashOtp(nurseryId, EMAIL, CODE) } });
  await page.getByLabel('קוד').fill(CODE);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('heading', { name: 'החשבון שלי' })).toBeVisible();
}

test('customer portal (R06-04): favorites, recently viewed, address book at checkout, order history, order again, isolation', async ({ page }) => {
  const db = new PrismaClient({ log: [] });
  try {
    const n = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eshop' } });
    await customerLogin(page, db, n.id);

    // מועדפים + נצפו לאחרונה מדף מוצר
    await page.goto(`${SHOP}/catalog`);
    await page.getByRole('link', { name: 'לבנדר רפואי' }).first().click();
    await page.getByRole('button', { name: 'הוספה למועדפים' }).click();
    await expect(page.getByRole('button', { name: 'במועדפים' })).toBeVisible();

    await page.goto(`${SHOP}/account`);
    const favorites = page.locator('section').filter({ has: page.getByRole('heading', { name: 'מועדפים' }) });
    await expect(favorites.getByText('לבנדר רפואי')).toBeVisible();
    const recent = page.locator('section').filter({ has: page.getByRole('heading', { name: 'נצפו לאחרונה' }) });
    await expect(recent.getByText('לבנדר רפואי')).toBeVisible();

    // ספר כתובות: מיקוד לא תקין נדחה (השדות נשמרים), תקין נשמר כברירת מחדל
    await page.getByLabel('עיר *').fill('רמת גן');
    await page.getByLabel('רחוב, מספר ודירה *').fill('ז׳בוטינסקי 10');
    await page.getByLabel('מיקוד').fill('123');
    await page.getByRole('button', { name: 'שמירת כתובת' }).click();
    await expect(page.getByText('מיקוד לא תקין — 7 ספרות')).toBeVisible();
    await expect(page.getByLabel('עיר *')).toHaveValue('רמת גן');
    await page.getByLabel('מיקוד').fill('5250001');
    await page.getByLabel('כינוי (בית, עבודה...)').fill('בית');
    await page.getByRole('button', { name: 'שמירת כתובת' }).click();
    await expect(page.getByTestId('addresses').getByText('ברירת מחדל')).toBeVisible();

    // קופה: בחירת כתובת שמורה ממלאת את הכתובת
    await page.goto(`${SHOP}/catalog`);
    // ריחן — בלי וריאנטים (ללבנדר בדיקה אחרת מוסיפה וריאנט)
    await page.locator('div.group').filter({ has: page.getByRole('heading', { name: 'ריחן מתוק' }) }).getByRole('button', { name: 'הוסף לעגלה' }).click();
    await page.goto(`${SHOP}/checkout`);
    await page.locator('input[name="customerPhone"]').fill('050-7777777');
    await page.locator('input[name="customerName"]').fill('לקוח פורטל');
    await page.locator('label', { hasText: 'משלוח עד הבית' }).click();
    await page.getByLabel('כתובת שמורה').selectOption({ label: 'בית: ז׳בוטינסקי 10, רמת גן' });
    await expect(page.locator('input[name="shippingAddress"]')).toHaveValue('ז׳בוטינסקי 10');
    await page.getByLabel('תשלום לשליח').check();
    await page.getByRole('button', { name: /שליחת ההזמנה|סיום|הזמנה/ }).click();
    await expect(page).toHaveURL(/\/checkout\/success\//);
    const order = await db.order.findFirstOrThrow({ where: { nurseryId: n.id, customerEmail: EMAIL } });
    expect(order.shippingAddress).toBe('ז׳בוטינסקי 10, רמת גן 5250001');
    expect(order.customerId).not.toBeNull();

    // היסטוריה → פרטים → הזמן שוב
    await page.goto(`${SHOP}/account`);
    await page.getByTestId('orders').getByRole('link').first().click();
    await expect(page.getByRole('heading', { name: `הזמנה #${order.id.slice(0, 8)}` })).toBeVisible();
    await expect(page.getByText('ריחן מתוק × 1')).toBeVisible();
    await page.getByRole('button', { name: 'הזמן שוב' }).click();
    await expect(page).toHaveURL(`${SHOP}/cart`);
    await expect(page.getByText('ריחן מתוק').first()).toBeVisible();

    // בידוד: הזמנה של לקוח אחר באותה משתלה → 404
    const other = await db.customer.create({ data: { nurseryId: n.id, email: `other-${EMAIL}` } });
    const foreign = await db.order.create({
      data: { nurseryId: n.id, customerId: other.id, customerName: 'אחר', customerEmail: other.email, customerPhone: '050', totalAmount: '5.00', stockState: 'NONE' },
    });
    await page.goto(`${SHOP}/account/orders/${foreign.id}`);
    await expect(page.getByRole('heading', { name: 'הדף לא נמצא' })).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
