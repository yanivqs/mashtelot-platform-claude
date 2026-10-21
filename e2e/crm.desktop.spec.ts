import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER6 } from './global-setup';

const RUN = Date.now();
const GUEST = `crm-guest-${RUN}@e2e.invalid`;
const FAN = `crm-fan-${RUN}@e2e.invalid`;

test('CRM (R06-05/07/08): guests and registered customers, group, tags, business type, notes, filter, consent-only export', async ({ page }) => {
  const db = new PrismaClient({ log: [] });
  try {
    const n = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eshop' } });
    await db.order.create({ data: { nurseryId: n.id, customerName: 'גנן אורח', customerEmail: GUEST, customerPhone: '050-1', totalAmount: '80.00', stockState: 'NONE' } });
    await db.customer.create({ data: { nurseryId: n.id, email: FAN, fullName: 'מעריצה', lastLoginAt: new Date(), marketingConsentAt: new Date() } });
  } finally {
    await db.$disconnect();
  }

  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER6.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER6.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.locator('aside nav').getByRole('link', { name: 'לקוחות' }).click();
  await expect(page.getByRole('heading', { name: 'לקוחות', exact: true })).toBeVisible();

  // קבוצה חדשה
  await page.getByLabel('שם קבוצה חדשה').fill(`קבלנים ${RUN}`);
  await page.getByRole('button', { name: 'הוספת קבוצה' }).click();
  await expect(page.locator('li').filter({ hasText: `קבלנים ${RUN}` })).toBeVisible();

  // חיפוש: האורח מההזמנות והלקוחה הרשומה
  await page.getByLabel('חיפוש').fill(`-${RUN}@`);
  await page.getByRole('button', { name: 'סינון' }).click();
  await expect(page.getByTestId('crm-row')).toHaveCount(2);
  const guestRow = page.getByTestId('crm-row').filter({ hasText: GUEST });
  await expect(guestRow.getByText('גנן אורח')).toBeVisible();
  await expect(page.getByTestId('crm-row').filter({ hasText: FAN }).getByText('רשום')).toBeVisible();

  // כרטיס לקוח: עסקי + קבוצה + תגיות + הערה
  await guestRow.getByRole('link', { name: 'גנן אורח' }).click();
  await expect(page.getByText(/אורח \(ללא חשבון\) · 1 הזמנות/)).toBeVisible();
  await page.getByLabel('תגיות (מופרדות בפסיק)').fill('VIP, שתילים');
  await page.getByLabel('קבוצה').selectOption({ label: `קבלנים ${RUN}` });
  await page.getByLabel('סוג לקוח').selectOption('BUSINESS');
  await page.getByLabel('שם החברה').fill('גנים ונופים בע"מ');
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect(page.getByText('נשמר ✓')).toBeVisible();
  await page.getByLabel('הערה חדשה').fill('מעדיף משלוח בבוקר');
  await page.getByRole('button', { name: 'הוספת הערה' }).click();
  await expect(page.getByTestId('notes').getByText('מעדיף משלוח בבוקר')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'גנים ונופים בע"מ' })).toBeVisible();

  // סינון לפי תגית וסוג
  await page.goto(`${ADMIN}/admin/customers?q=${encodeURIComponent(`-${RUN}@`)}&tag=VIP&type=BUSINESS`);
  await expect(page.getByTestId('crm-row')).toHaveCount(1);
  await expect(page.getByTestId('crm-row').getByText('עסקי')).toBeVisible();

  // יצוא: רק מי שהסכים לדיוור (הלקוחה הרשומה), גם כשהסינון כולל את שניהם
  await page.goto(`${ADMIN}/admin/customers?q=${encodeURIComponent(`-${RUN}@`)}`);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'יצוא לשיווק (CSV)' }).click();
  const file = await download;
  const content = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'));
  expect(content).toContain(FAN);
  expect(content).not.toContain(GUEST);
  await expect(page.getByTestId('export-msg')).toHaveText('יוצאו 1 לקוחות שהסכימו לדיוור');
});
