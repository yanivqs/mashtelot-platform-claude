import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { SHOP } from '../playwright.config';
import { hashOtp } from '../lib/customer-otp';

const EMAIL = `privacy-${Date.now()}@e2e.invalid`;
const CODE = '975310';

test('privacy (R06-09): the customer downloads their data and deletes the account; orders stay without personal details', async ({ page }) => {
  const db = new PrismaClient({ log: [] });
  try {
    const n = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eshop' } });
    await db.order.create({
      data: { nurseryId: n.id, customerName: 'פרטיות', customerEmail: EMAIL, customerPhone: '050-3', shippingAddress: 'האלה 3, רמת גן', totalAmount: '55.00', status: 'DELIVERED', stockState: 'NONE' },
    });

    await page.goto(`${SHOP}/account`);
    await page.getByLabel('אימייל').fill(EMAIL);
    await page.getByRole('button', { name: 'שליחת קוד' }).click();
    await expect(page.getByText(/שלחנו קוד/)).toBeVisible();
    const otp = await db.customerOtp.findFirstOrThrow({ where: { nurseryId: n.id, email: EMAIL, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    await db.customerOtp.update({ where: { id: otp.id }, data: { codeHash: hashOtp(n.id, EMAIL, CODE) } });
    await page.getByLabel('קוד').fill(CODE);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByRole('heading', { name: 'החשבון שלי' })).toBeVisible();

    // הורדת המידע
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'הורדת המידע שלי' }).click();
    const file = await download;
    const json = JSON.parse(Buffer.concat(await (await file.createReadStream()).toArray()).toString('utf8'));
    expect(json.profile.email).toBe(EMAIL);
    expect(json.orders[0]).toMatchObject({ totalAmount: 55, shippingAddress: 'האלה 3, רמת גן' });

    // מחיקה: בלי אישור — נדחה; עם אישור — נמחק ומנותק
    await page.getByRole('button', { name: 'מחיקת החשבון' }).click();
    await expect(page.getByText('יש לסמן שאתם מבינים שהמחיקה סופית')).toBeVisible();
    await page.getByLabel('אני מבין/ה שהמחיקה סופית').check();
    await page.getByRole('button', { name: 'מחיקת החשבון' }).click();
    await expect(page.getByTestId('account-deleted')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'כניסה לחשבון' })).toBeVisible();

    expect(await db.customer.count({ where: { nurseryId: n.id, email: EMAIL } })).toBe(0);
    expect(await db.order.count({ where: { nurseryId: n.id, customerEmail: EMAIL } })).toBe(0);
    const anon = await db.order.findFirstOrThrow({ where: { nurseryId: n.id, totalAmount: '55.00', customerName: 'לקוח שנמחק' }, orderBy: { createdAt: 'desc' } });
    expect(anon).toMatchObject({ customerPhone: '', shippingAddress: null });
  } finally {
    await db.$disconnect();
  }
});
