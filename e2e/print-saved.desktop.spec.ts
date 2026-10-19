import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER3, E2E_SAVED_TEMPLATE, E2E_SUPER2 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

const NAME = 'תווית לוגו קבועה';

test('fixed product: submit → reject with note → resubmit → approve → reorder → change request (PT-04)', async ({ page }) => {
  // המשתלה מגישה מפרט
  await login(page, E2E_OWNER3);
  await page.goto(`${ADMIN}/admin/print-shop`);
  const card = page.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: E2E_SAVED_TEMPLATE }) });
  await card.getByRole('button', { name: 'הזמנה' }).click();
  await card.getByLabel('טקסט').fill('משתלת הדר');
  await card.getByLabel('גודל').selectOption('s');
  await card.getByRole('button', { name: /שמרו כמוצר קבוע/ }).click();
  await card.getByLabel('שם למוצר הקבוע').fill(NAME);
  await card.getByRole('button', { name: 'הגשה לאישור בית הדפוס' }).click();
  await expect(card.getByText(/נשלח לאישור בית הדפוס/)).toBeVisible();

  await page.reload();
  const saved = page.locator('div.rounded-xl').filter({ has: page.getByRole('heading', { name: NAME }) });
  await expect(saved.getByText('ממתין לאישור בית הדפוס')).toBeVisible();
  await expect(saved.getByRole('button', { name: 'הזמנה חוזרת' })).toHaveCount(0);

  // בית הדפוס דוחה עם הערה
  await login(page, E2E_SUPER2);
  await page.getByRole('link', { name: 'אישורי מפרט (1)' }).click();
  const req = page.locator('section').filter({ hasText: NAME });
  await req.getByRole('button', { name: 'דחייה' }).click();
  await expect(req.getByText('בדחייה יש לכתוב למשתלה מה לתקן')).toBeVisible();
  await req.getByLabel('הערה למשתלה').fill('נא להגדיל את המדבקה');
  await req.getByRole('button', { name: 'דחייה' }).click();
  await expect(page.getByText('אין בקשות ממתינות')).toBeVisible();

  // המשתלה רואה את ההערה ומגישה מחדש
  await login(page, E2E_OWNER3);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await expect(saved.getByText('הערת בית הדפוס: נא להגדיל את המדבקה')).toBeVisible();
  await saved.getByRole('button', { name: 'הגשה מחדש' }).click();
  await saved.getByLabel('גודל').selectOption('l');
  await saved.getByRole('button', { name: 'הגשת השינוי לאישור' }).click();
  await expect(saved.getByText('ממתין לאישור בית הדפוס')).toBeVisible();

  // בית הדפוס מאשר
  await login(page, E2E_SUPER2);
  await page.goto(`${ADMIN}/admin/print-specs`);
  await page.locator('section').filter({ hasText: NAME }).getByRole('button', { name: 'אישור המפרט' }).click();
  await expect(page.getByText('אין בקשות ממתינות')).toBeVisible();

  // הזמנה חוזרת מהמפרט המאושר: (2 + גדול 1) × 20 = 60
  await login(page, E2E_OWNER3);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await expect(saved.getByText('מאושר', { exact: true })).toBeVisible();
  await expect(saved.getByText('גודל: גדול')).toBeVisible();
  await saved.getByLabel(`כמות — ${NAME}`).fill('20');
  await expect(saved.getByText('משוער: ‏60 ‏₪').or(saved.getByText(/משוער: .*60/))).toBeVisible();
  await saved.getByRole('button', { name: 'הזמנה חוזרת' }).click();
  await expect(saved.getByText(/ההזמנה התקבלה ✓/)).toBeVisible();

  // בקשת שינוי — המפרט המאושר נשאר פעיל עד האישור
  await saved.getByRole('button', { name: 'בקשת שינוי במפרט' }).click();
  await saved.getByLabel('טקסט').fill('משתלת הדר — סניף 2');
  await saved.getByRole('button', { name: 'הגשת השינוי לאישור' }).click();
  await expect(saved.getByText('שינוי ממתין לאישור')).toBeVisible();
  await expect(saved.getByRole('button', { name: 'הזמנה חוזרת' })).toBeVisible();

  // בית הדפוס רואה את השינוי מול המפרט המאושר
  await login(page, E2E_SUPER2);
  await page.goto(`${ADMIN}/admin/print-specs`);
  const change = page.locator('section').filter({ hasText: NAME });
  await expect(change.getByRole('cell', { name: 'משתלת הדר', exact: true })).toBeVisible();
  await expect(change.getByRole('cell', { name: 'משתלת הדר — סניף 2' })).toBeVisible();
});
