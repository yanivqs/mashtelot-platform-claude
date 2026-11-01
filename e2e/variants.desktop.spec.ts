import { expect, test, type Page } from './fixtures';
import { PrismaClient } from '@prisma/client';
import { ADMIN, SHOP } from '../playwright.config';
import { E2E_OWNER2 } from './global-setup';

const card = (page: Page, title: string) =>
  page.locator('main div.group').filter({ has: page.getByRole('heading', { name: title }) });

test('catalog card shows a price range and a choose-option button (§7.01)', async ({ page }) => {
  await page.goto(`${SHOP}/catalog`);
  const ficus = card(page, 'פיקוס כינורי');
  await expect(ficus.getByText('החל מ-')).toBeVisible();
  await expect(ficus.getByRole('link', { name: 'לבחירת גודל עציץ' })).toBeVisible();
  await expect(ficus.getByRole('button', { name: 'הוסף לעגלה' })).toHaveCount(0);
  // מוצר פשוט — ללא שינוי
  await expect(card(page, 'ורד אדום').getByRole('button', { name: 'הוסף לעגלה' })).toBeVisible();
});

test('choose a variant on the product page, buy it, and the order records the variant', async ({ page }) => {
  await page.goto(`${SHOP}/catalog`);
  await card(page, 'פיקוס כינורי').getByRole('link', { name: 'לבחירת גודל עציץ' }).click();

  const price = page.getByTestId('variant-price');
  await expect(page.getByRole('group', { name: 'גודל עציץ' })).toBeVisible();
  await expect(price).toContainText('59.9'); // ברירת המחדל יורשת את מחיר המוצר
  await expect(page.locator('label', { hasText: 'עציץ 10 ליטר' })).toContainText('(אזל)');

  await page.locator('label', { hasText: 'עציץ 4 ליטר' }).click();
  await expect(price).toContainText('89');
  await expect(page.getByText("במלאי (2 יח')")).toBeVisible();

  // וריאנט שאזל — אי אפשר להוסיף
  await page.locator('label', { hasText: 'עציץ 10 ליטר' }).click();
  await expect(page.getByRole('button', { name: 'אזל מהמלאי' })).toBeDisabled();

  await page.locator('label', { hasText: 'עציץ 4 ליטר' }).click();
  await page.getByRole('button', { name: 'הוסף לעגלה' }).click();

  await page.goto(`${SHOP}/cart`);
  await expect(page.getByText('פיקוס כינורי — עציץ 4 ליטר')).toBeVisible();

  await page.goto(`${SHOP}/checkout`);
  await page.locator('input[name="customerName"]').fill('קונה וריאנט');
  await page.locator('input[name="customerPhone"]').fill('050-7654321');
  const email = `variant-${Date.now()}@e2e.invalid`;
  await page.locator('input[name="customerEmail"]').fill(email);
  await page.locator('label', { hasText: 'איסוף עצמי מהמשתלה' }).click();
  await page.getByRole('button', { name: /שליחת ההזמנה|סיום|הזמנה/ }).click();
  await expect(page).toHaveURL(/\/checkout\/success\//);

  const db = new PrismaClient({ log: [] });
  try {
    const order = await db.order.findFirstOrThrow({ where: { customerEmail: email }, include: { items: true } });
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ variantName: 'עציץ 4 ליטר', quantity: 1 });
    expect(Number(order.items[0]!.unitPrice)).toBe(89);
    expect(Number(order.totalAmount)).toBe(89);
    const v = await db.productVariant.findUniqueOrThrow({ where: { id: order.items[0]!.variantId! } });
    expect(v.reservedQuantity).toBe(1);
  } finally {
    await db.$disconnect();
  }
});

test('owner adds a variant in the admin and the storefront offers a choice', async ({ page }) => {
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(E2E_OWNER2.email);
  await page.locator('input[name="password"]').fill(E2E_OWNER2.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);

  await page.goto(`${ADMIN}/admin/products`);
  // לחיצה על שם המוצר פותחת את דף העריכה שלו
  await page.getByRole('link', { name: 'לבנדר רפואי' }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  const row = page.locator('main');
  await row.getByRole('button', { name: '+ הוספת וריאנט' }).click();

  const forms = row.locator('form').filter({ has: page.locator('input[name="variantId"]') });
  // האפשרות הקיימת מקבלת שם
  const existing = forms.nth(0);
  await existing.locator('input[name="name"]').fill('שתיל קטן');
  await existing.getByRole('button', { name: 'שמירת וריאנט' }).click();
  await expect(existing.getByText('נשמר ✓')).toBeVisible();

  // שגיאה: וריאנט בלי שם — ההודעה מוצגת והמחיר שהוקלד נשמר
  const added = forms.last();
  await added.locator('input[name="price"]').fill('39.90');
  await added.getByRole('button', { name: 'הוספת וריאנט' }).click();
  await expect(added.getByText(/יש לתת שם לווריאנט/)).toBeVisible();
  await expect(added.locator('input[name="price"]')).toHaveValue('39.90');

  await added.locator('input[name="name"]').fill('שיח בוגר');
  await added.locator('input[name="stockQuantity"]').fill('3');
  await added.getByRole('button', { name: 'הוספת וריאנט' }).click();
  await expect(page.getByText('הווריאנט נוסף ✓')).toBeVisible();

  await page.goto(`${SHOP}/catalog`);
  await expect(card(page, 'לבנדר רפואי').getByRole('link', { name: 'לבחירת אפשרות' })).toBeVisible();
});
