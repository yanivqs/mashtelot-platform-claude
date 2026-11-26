import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_SIGN_PLANTS, E2E_SIGNS_OWNER, E2E_SUPER11 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

const DESCRIPTION = 'טקסט E2E לשלט: לבנדר ריחנית לגינה שמשית.';

test('plant signs: owner picks plants, edits and orders; print house generates the PDF; owner cannot download it', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, E2E_SIGNS_OWNER);

  // בחירת שני הצמחים ברשימת המוצרים
  await page.goto(`${ADMIN}/admin/products`);
  for (const name of E2E_SIGN_PLANTS) await page.getByRole('checkbox', { name: `בחירה לשלטי צמחים: ${name}` }).check();
  await page.getByTestId('sign-pick-submit').click();
  await expect(page).toHaveURL(/\/admin\/print-shop\/plant-signs\?/);
  await expect(page.getByTestId('sign-lines').getByRole('listitem')).toHaveCount(2);
  // רשימת ההוספה נשארת גלויה גם אחרי שנבחרו צמחים (כאן כל צמחי המשתלה כבר נבחרו)
  await expect(page.getByText('כל הצמחים כבר נוספו')).toBeVisible();
  await page.getByRole('button', { name: E2E_SIGN_PLANTS[0]!, exact: true }).click();

  // תצוגה מקדימה של הצמח הראשון: שם, שם לטיני, אור והשקיה, ובלי אפשרות הורדה
  const preview = page.getByRole('img', { name: `תצוגה מקדימה של שלט: ${E2E_SIGN_PLANTS[0]}` });
  await expect(preview).toBeVisible();
  await expect(preview.locator('.ps-title')).toHaveText(E2E_SIGN_PLANTS[0]!);
  await expect(preview.locator('.ps-latin')).toHaveText('Lavandula angustifolia');
  await expect(preview).toContainText('שמש מלאה');
  await expect(preview).toContainText('השקיה בינונית');
  // אותו שם משתמש בפייסבוק ובאינסטגרם — שורה אחת "עקבו אחרינו @e2e"
  await expect(preview).toContainText('עקבו אחרינו');
  await expect(preview).toContainText('@e2e');
  await expect(page.getByRole('link', { name: /PDF|הורדה/ })).toHaveCount(0);

  // עריכה: תיאור והערה, שמירה למוצר
  await page.getByTestId('sign-description').fill(DESCRIPTION);
  await page.getByTestId('sign-notes').fill('מבצע השבוע');
  await expect(preview.locator('.ps-desc')).toHaveText(DESCRIPTION);
  await page.getByTestId('sign-save').click();
  await expect(page.getByText('נשמר ✓')).toBeVisible();

  // כמויות ומחיר (2 ₪ לשלט): 3 + 1 = 4 שלטים
  await page.getByRole('spinbutton', { name: new RegExp(`^כמות שלטים ל${E2E_SIGN_PLANTS[0]}`) }).fill('3');
  await expect(page.getByTestId('signs-total')).toHaveText('4');
  await page.getByLabel(/חומר/).selectOption('paper');
  await expect(page.getByTestId('signs-price')).toContainText('8');

  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

  await page.getByTestId('signs-submit').click();
  await expect(page.getByTestId('signs-ordered')).toBeVisible();

  // בית הדפוס: השלטים בהזמנה והפקת PDF
  await login(page, E2E_SUPER11);
  await page.goto(`${ADMIN}/admin/print-orders`);
  const panel = page.getByTestId('plant-signs-panel').first();
  await expect(panel).toContainText('2 צמחים · 4 שלטים');
  await expect(panel).toContainText(`${E2E_SIGN_PLANTS[0]} × 3`);
  await panel.getByTestId('plant-signs-pdf').click();
  await expect(panel.getByRole('status')).toContainText('נוצר PDF עם 2 שלטים', { timeout: 90_000 });

  const db = new PrismaClient({ log: [] });
  let fileKey = '';
  try {
    const order = await db.printOrder.findFirstOrThrow({
      where: { nursery: { subdomain: 'e2esigns' } },
      orderBy: { createdAt: 'desc' },
      include: { productionFile: true, plantSigns: { orderBy: { sortOrder: 'asc' } } },
    });
    expect(order.productionFile?.kind).toBe('PRODUCTION');
    expect(order.productionFile?.mimeType).toBe('application/pdf');
    const lavender = order.plantSigns.find((x) => (x.data as { hebrewName: string }).hebrewName === E2E_SIGN_PLANTS[0]);
    expect((lavender!.data as { description: string; notes: string }).description).toBe(DESCRIPTION);
    expect(lavender!.quantity).toBe(3);
    fileKey = order.productionFile!.storageKey;
  } finally {
    await db.$disconnect();
  }
  // הקובץ באחסון המקומי של הבדיקות: PDF אמיתי, עמוד לכל שלט
  const bytes = await readFile(path.join(process.env.PRINT_LOCAL_DIR || path.join(os.tmpdir(), 'mashtelot-print-files'), fileKey));
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect((bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2);

  // קישור ההורדה (חתום) עובד לבית הדפוס...
  await page.reload();
  const link = page.getByRole('link', { name: /plant-signs-.*\.pdf/ }).first();
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  expect((await page.request.get(`${ADMIN}${href}`)).status()).toBe(200);

  // ...ולא לבעל המשתלה, גם עם אותו קישור
  await login(page, E2E_SIGNS_OWNER);
  expect((await page.request.get(`${ADMIN}${href}`)).status()).toBe(404);
});
