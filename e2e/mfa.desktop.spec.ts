import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER5, E2E_SUPER4 } from './global-setup';
import { totp } from '../lib/totp';

// שתי הבדיקות משתמשות ב-super4 — ברצף, כדי שהפעלת MFA בשנייה לא תשפיע על ההתחברות בראשונה
test.describe.configure({ mode: 'serial' });

async function password(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
}

test('MFA (§4.04): enable with QR, login needs a code, recovery code works once, super admin resets', async ({ page }) => {
  // הפעלה
  await password(page, E2E_OWNER5);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.goto(`${ADMIN}/admin/account`);
  await page.getByRole('button', { name: 'הפעלת אימות דו-שלבי' }).click();
  await expect(page.getByAltText('קוד QR להפעלת אימות דו-שלבי')).toBeVisible();
  const secret = (await page.getByTestId('mfa-secret').textContent())!.trim();
  await page.getByLabel('קוד מהאפליקציה לאישור').fill('000000');
  await page.getByRole('button', { name: 'אישור והפעלה' }).click();
  await expect(page.getByText(/הקוד שגוי/)).toBeVisible();
  await expect(page.getByAltText('קוד QR להפעלת אימות דו-שלבי')).toBeVisible(); // נשאר אחרי שגיאה
  await page.getByLabel('קוד מהאפליקציה לאישור').fill(totp(secret));
  await page.getByRole('button', { name: 'אישור והפעלה' }).click();
  await expect(page.getByText('פעיל', { exact: true })).toBeVisible();
  const codes = (await page.getByTestId('recovery-codes').locator('li').allTextContents()).map((c) => c.trim());
  expect(codes).toHaveLength(8);
  // המכשיר הנוכחי נשאר מחובר אחרי ההפעלה
  await page.reload();
  await expect(page.getByText('פעיל', { exact: true })).toBeVisible();

  // התחברות: סיסמה → מסך קוד; בלי קוד אין גישה
  await password(page, E2E_OWNER5);
  await expect(page).toHaveURL(`${ADMIN}/admin/login/mfa`);
  await page.goto(`${ADMIN}/admin`);
  await expect(page).toHaveURL(`${ADMIN}/admin/login`);
  await page.goto(`${ADMIN}/admin/login/mfa`);
  await page.getByLabel('קוד אימות').fill('123456');
  await page.getByRole('button', { name: 'אימות' }).click();
  await expect(page.getByText('קוד שגוי או שכבר נוצל')).toBeVisible();
  // הקוד של ההפעלה כבר נוצל — הצעד הבא (סטיית שעון מותרת ±1)
  await page.getByLabel('קוד אימות').fill(totp(secret, Date.now() + 30_000));
  await page.getByRole('button', { name: 'אימות' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  // קוד שחזור — פעם אחת
  await password(page, E2E_OWNER5);
  await page.getByLabel('קוד אימות').fill(codes[0]!);
  await page.getByRole('button', { name: 'אימות' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin/account?recovery=1`);
  await expect(page.getByText(/נכנסתם עם קוד שחזור \(נותרו 7\)/)).toBeVisible();
  await password(page, E2E_OWNER5);
  await page.getByLabel('קוד אימות').fill(codes[0]!);
  await page.getByRole('button', { name: 'אימות' }).click();
  await expect(page.getByText('קוד שגוי או שכבר נוצל')).toBeVisible();

  // סופר-אדמין מאפס (המשתמש איבד את הטלפון)
  const db = new PrismaClient({ log: [] });
  let nurseryId: string;
  try {
    nurseryId = (await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eshop' } })).id;
  } finally {
    await db.$disconnect();
  }
  await password(page, E2E_SUPER4);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.goto(`${ADMIN}/admin/nurseries/${nurseryId}`);
  const row = page.locator('li').filter({ hasText: E2E_OWNER5.email });
  await expect(row.getByText('אימות דו-שלבי פעיל')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: 'איפוס אימות דו-שלבי' }).click();
  // אחרי האיפוס הדף מתרענן: המשתמש מוצג בלי אימות דו-שלבי
  await expect(row.getByText('ללא אימות דו-שלבי')).toBeVisible();

  // אחרי איפוס — סיסמה בלבד
  await password(page, E2E_OWNER5);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
});

test('super admin can enable and disable MFA (owner decision)', async ({ page }) => {
  await password(page, E2E_SUPER4);
  await expect(page).toHaveURL(`${ADMIN}/admin`);
  await page.goto(`${ADMIN}/admin/account`);
  await page.getByRole('button', { name: 'הפעלת אימות דו-שלבי' }).click();
  const secret = (await page.getByTestId('mfa-secret').textContent())!.trim();
  await page.getByLabel('קוד מהאפליקציה לאישור').fill(totp(secret));
  await page.getByRole('button', { name: 'אישור והפעלה' }).click();
  await expect(page.getByText('פעיל', { exact: true })).toBeVisible();
  const code = (await page.getByTestId('recovery-codes').locator('li').first().textContent())!.trim();

  await page.getByLabel('קוד לביטול האימות הדו-שלבי').fill(code);
  await page.getByRole('button', { name: 'ביטול אימות דו-שלבי' }).click();
  await expect(page.getByRole('button', { name: 'הפעלת אימות דו-שלבי' })).toBeVisible();
  await expect(page.getByText('כבוי', { exact: true })).toBeVisible();
});
