import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_ROUND3_OWNER, E2E_SUPER8, ROUND3_SHOP } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const TITLE = 'עיצוב של הפלטפורמה E2E';

test('super admin designs the home page of a nursery without the module; the owner cannot edit it', async ({ page, browser }) => {
  test.setTimeout(90000);
  const db = new PrismaClient();
  const nursery = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eround3' } });
  await db.$disconnect();

  await login(page, E2E_SUPER8);
  await page.goto(`${ADMIN}/admin/nurseries/${nursery.id}`);
  await page.getByRole('link', { name: 'עיצוב דף הבית' }).click();
  const status = page.getByTestId('managed-home-status');
  await expect(status).toContainText('הרגיל');

  await page.getByLabel('סוג בלוק להוספה').selectOption('cta');
  await page.getByRole('button', { name: 'הוספת בלוק' }).click();
  await page.getByLabel('כותרת *').fill(TITLE);
  await page.getByLabel('קישור הכפתור (/catalog או https://…)').fill('/catalog');
  await expect(page.getByTestId('draft-status')).toHaveText('הטיוטה נשמרה');
  await expect(page.frameLocator('iframe[title="תצוגה מקדימה"]').getByRole('heading', { name: TITLE })).toBeVisible();

  await page.getByRole('button', { name: 'פרסום', exact: true }).click();
  await expect(page.getByText('גרסה 1 פורסמה ✓')).toBeVisible();

  // פורסם, אבל החנות לא מציגה עד שהסופר-אדמין בוחר בזה
  const shop = await page.context().newPage();
  await shop.goto(`${ROUND3_SHOP}/`);
  await expect(shop.getByText(TITLE)).toHaveCount(0);

  await page.getByRole('button', { name: 'הצגת העיצוב שלי בחנות' }).click();
  await expect(status).toContainText('מהבלוקים');
  await shop.goto(`${ROUND3_SHOP}/`);
  await expect(shop.getByRole('heading', { name: TITLE })).toBeVisible();

  // בעל המשתלה לא רואה ולא יכול לערוך
  const ownerCtx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '10.79.0.1' } });
  const owner = await ownerCtx.newPage();
  await login(owner, E2E_ROUND3_OWNER);
  await expect(owner.getByRole('link', { name: 'עיצוב דף הבית' })).toHaveCount(0);
  await owner.goto(`${ADMIN}/admin/page-builder`);
  await expect(owner.getByRole('heading', { name: 'עיצוב דף הבית' })).toHaveCount(0);
  await owner.goto(`${ADMIN}/admin/preview/home?nursery=${nursery.id}`);
  await expect(owner.getByText(TITLE)).toHaveCount(0);
  await ownerCtx.close();

  await page.getByRole('button', { name: 'הפסקת הצגת העיצוב שלי בחנות' }).click();
  await expect(status).toContainText('הרגיל');
  await shop.goto(`${ROUND3_SHOP}/`);
  await expect(shop.getByText(TITLE)).toHaveCount(0);
});

test('newsletter: a visitor subscribes with consent; the owner sees, exports and removes', async ({ page }) => {
  const email = 'visitor@e2e.invalid';
  await page.goto(`${ROUND3_SHOP}/`);
  const form = page.getByTestId('newsletter');
  await form.getByLabel('כתובת אימייל לתפוצת הדואר').fill(email);
  await form.getByLabel(/אני מסכים/).check();
  await form.getByRole('button', { name: 'הרשמה' }).click();
  await expect(form.getByRole('status')).toContainText('נרשמתם');

  await login(page, E2E_ROUND3_OWNER);
  await page.getByRole('link', { name: 'תפוצת דואר' }).click();
  await expect(page.getByTestId('newsletter-active')).toContainText('1');
  await expect(page.getByTestId('newsletter-row')).toContainText(email);

  await page.getByRole('button', { name: 'יצוא לקובץ CSV' }).click();
  await expect(page.getByTestId('newsletter-export-msg')).toContainText('יוצאו 1 כתובות');

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: `הסרת ${email} מהתפוצה` }).click();
  await expect(page.getByTestId('newsletter-row')).toContainText('הוסר');
  await expect(page.getByTestId('newsletter-active')).toContainText('0');
});

test('image folder: the owner enlarges an image and closes it', async ({ page }) => {
  await login(page, E2E_ROUND3_OWNER);
  await page.goto(`${ADMIN}/admin/products/images`);
  await page.getByLabel('בחירת תמונות להעלאה').setInputFiles([{ name: 'plant.png', mimeType: 'image/png', buffer: PNG }]);
  await page.getByRole('button', { name: 'הגדלת plant.png' }).click();
  const big = page.getByTestId('zoomed-image');
  await expect(big).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(big).toBeHidden();

  await page.getByRole('button', { name: 'הגדלת plant.png' }).click();
  await expect(big).toBeVisible();
  await page.getByRole('button', { name: 'סגירת התצוגה המוגדלת' }).click();
  await expect(big).toBeHidden();
});
