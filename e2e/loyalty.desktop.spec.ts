import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { ADMIN, SHOP } from '../playwright.config';
import { E2E_OWNER7 } from './global-setup';
import { hashOtp } from '../lib/customer-otp';

const RUN = Date.now();
const EMAIL = `club-${RUN}@e2e.invalid`;
const CODE = '864201';

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

test('club (R06-06/07): owner sets point value and group discount; customer sees benefits, checkout applies group discount and redeems points', async ({ page }) => {
  const db = new PrismaClient({ log: [] });
  try {
    const n = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eshop' } });
    const group = await db.customerGroup.create({ data: { nurseryId: n.id, name: `מועדון ${RUN}` } });
    const c = await db.customer.create({ data: { nurseryId: n.id, email: EMAIL, fullName: 'חברת מועדון', phone: '050-9999999', groupId: group.id } });
    await db.loyaltyEntry.create({ data: { nurseryId: n.id, customerId: c.id, kind: 'ADJUST', points: 200, note: 'מתנת הצטרפות' } });

    // בעל המשתלה: שווי נקודה + הנחת קבוצה
    await page.goto(`${ADMIN}/admin/login`);
    await page.locator('input[name="email"]').fill(E2E_OWNER7.email);
    await page.locator('input[name="password"]').fill(E2E_OWNER7.password);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(`${ADMIN}/admin`);
    await page.locator('aside nav').getByRole('link', { name: 'מועדון לקוחות' }).click();
    await expect(page.getByTestId('loyalty-summary')).toContainText('כבויים');
    await page.getByLabel('שווי נקודה (₪)').fill('0.05');
    await expect(page.getByTestId('loyalty-summary')).toHaveText('הלקוח מקבל בחזרה כ-5.0% מסכום הקנייה בנקודות.');
    await page.getByRole('button', { name: 'שמירה' }).click();
    await expect(page.getByText('נשמר ✓')).toBeVisible();

    await page.goto(`${ADMIN}/admin/customers`);
    await page.getByLabel(`הנחת קבוצה — מועדון ${RUN}`).fill('10');
    await page.locator('li').filter({ hasText: `מועדון ${RUN}` }).getByRole('button', { name: 'שמירה' }).click();
    await expect(page.locator('li').filter({ hasText: `מועדון ${RUN}` }).getByText('✓')).toBeVisible();

    // הלקוחה: ההטבות באזור האישי
    await customerLogin(page, db, n.id);
    await expect(page.getByTestId('my-group')).toContainText('10% הנחה');
    await expect(page.getByTestId('my-points')).toContainText('200');

    // קופה: הנחת קבוצה + מימוש 40 נקודות (2 ₪)
    await page.goto(`${SHOP}/catalog`);
    await page.locator('div.group').filter({ has: page.getByRole('heading', { name: 'ריחן מתוק' }) }).getByRole('button', { name: 'הוסף לעגלה' }).click();
    await page.goto(`${SHOP}/checkout`);
    await expect(page.getByTestId('group-discount')).toContainText('10%');
    await page.locator('label', { hasText: 'איסוף עצמי מהמשתלה' }).click();
    await page.getByLabel('נקודות למימוש').fill('40');
    await expect(page.getByTestId('points-discount')).toContainText('מימוש 40 נקודות');
    await page.getByRole('button', { name: /שליחת ההזמנה|סיום|הזמנה/ }).click();
    await expect(page).toHaveURL(/\/checkout\/success\//);

    const o = await db.order.findFirstOrThrow({ where: { nurseryId: n.id, customerEmail: EMAIL }, orderBy: { createdAt: 'desc' } });
    expect([Number(o.groupDiscountPct), o.loyaltyPointsUsed, Number(o.loyaltyDiscount)]).toEqual([10, 40, 2]);
    expect(Number(o.totalAmount)).toBeCloseTo(Number(o.subtotalAmount) * 0.9 - 2, 2);
    const balance = await db.loyaltyEntry.aggregate({ where: { customerId: c.id }, _sum: { points: true } });
    expect(balance._sum.points).toBe(160);

    // בעל המשתלה רואה את היתרה ואת היומן בכרטיס הלקוח
    await page.goto(`${ADMIN}/admin/login`);
    await page.locator('input[name="email"]').fill(E2E_OWNER7.email);
    await page.locator('input[name="password"]').fill(E2E_OWNER7.password);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(`${ADMIN}/admin`);
    await page.goto(`${ADMIN}/admin/customers/view?email=${encodeURIComponent(EMAIL)}`);
    await expect(page.getByTestId('points-balance')).toHaveText('יתרה: 160 נקודות');
    await expect(page.getByText('מימוש בהזמנה')).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
