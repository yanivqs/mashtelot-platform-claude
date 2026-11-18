import AxeBuilder from '@axe-core/playwright';
import { devices } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_GRID_OWNER, FLOAT_SHOP as SHOP } from './global-setup';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function waitSaved(page: Page) {
  await expect(page.getByTestId('draft-status')).toHaveText('הטיוטה נשמרה');
}

test('categories block: images, cube layout on desktop, per-row and ratio on mobile', async ({ page, browser }) => {
  const db = new PrismaClient();
  // חנות הסרגל הצף: פרחים (ובתוכה ורדים) ומוצרי גינון, עם מוצרים פעילים
  const shop = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efloat' } });
  const slugs = ['e2e-flowers', 'e2e-roses', 'e2e-garden'];
  const cats = await Promise.all(slugs.map((slug) => db.nurseryCategory.findUniqueOrThrow({ where: { nurseryId_slug: { nurseryId: shop.id, slug } } })));
  const names = cats.map((c) => c.name);

  try {
    await page.goto(`${ADMIN}/admin/login`);
    await page.locator('input[name="email"]').fill(E2E_GRID_OWNER.email);
    await page.locator('input[name="password"]').fill(E2E_GRID_OWNER.password);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(`${ADMIN}/admin`);
    await page.getByRole('link', { name: 'עיצוב דף הבית' }).click();

    await page.getByLabel('סוג בלוק להוספה').selectOption('categories');
    await page.getByRole('button', { name: 'הוספת בלוק' }).click();
    for (const c of cats) await page.getByRole('checkbox', { name: c.name }).check();

    // השנייה רחבה — כמו בהדמיה: 4 + 8 + 4 = 16 קוביות בשורה אחת
    await page.getByTestId(`category-tile-${cats[1]!.id}`).getByLabel(/רחב: 8 קוביות/).check();
    await expect(page.getByText('פריסה במחשב: 16 קוביות בשורה (8×2)')).toBeVisible();
    await expect(page.getByTestId('category-cubes').locator('div[title]')).toHaveCount(3);
    await expect(page.getByText(/נשארו \d+ קוביות ריקות/)).toHaveCount(0);

    // תמונה ב-http (אחסון הבדיקות) נדחית — מותרות רק כתובות https
    const tileA = page.getByTestId(`category-tile-${cats[0]!.id}`);
    const chooser = page.waitForEvent('filechooser');
    await tileA.getByRole('button', { name: 'העלאת תמונה' }).click();
    await (await chooser).setFiles({ name: 'cat-a.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('תמונת קטגוריה: כתובת תמונה לא תקינה')).toBeVisible();
    await tileA.getByRole('button', { name: 'הסרה' }).click();

    // נייד: 2 בשורה (ברירת מחדל), יחס רחב
    await page.getByRole('radio', { name: 'רחב 2:1' }).check();
    await waitSaved(page);

    // תמונה בכתובת https (כמו באחסון האמיתי) — נכתבת לטיוטה ישירות, כי אחסון הבדיקות מגיש ב-http
    const layout = await db.pageLayout.findUniqueOrThrow({ where: { nurseryId_key: { nurseryId: shop.id, key: 'home' } } });
    const draft = layout.draftBlocks as Array<Record<string, unknown>>;
    const block = draft.find((x) => x.type === 'categories')!;
    block.items = { ...(block.items as object), [cats[0]!.id]: { imageUrl: 'https://images.unsplash.com/photo-e2e-cat-a', size: 'normal' } };
    await db.pageLayout.update({ where: { id: layout.id }, data: { draftBlocks: draft as object[] } });
    await page.reload();
    const tileAgain = page.getByTestId(`category-tile-${cats[0]!.id}`);
    if (!(await tileAgain.isVisible())) await page.getByRole('button', { name: /קטגוריות/ }).first().click();
    await expect(tileAgain.getByRole('button', { name: 'החלפת תמונה' })).toBeVisible();

    await page.getByRole('button', { name: 'פרסום', exact: true }).click();
    await expect(page.getByText(/פורסמה ✓/)).toBeVisible();

    // מחשב: האריח הרחב ברוחב כפול (בתוספת הרווח), באותה שורה, השם מתחת לתמונה, ו-axe נקי
    const store = await page.context().newPage();
    await store.goto(`${SHOP}/`);
    const grid = store.getByTestId('category-grid');
    await expect(grid).toBeVisible();
    const wide = (await grid.locator('li[data-size="wide"]').boundingBox())!;
    const normal = (await grid.locator('li[data-size="normal"]').first().boundingBox())!;
    expect(Math.abs(wide.width - (normal.width * 2 + 16))).toBeLessThan(3);
    expect(Math.abs(wide.y - normal.y)).toBeLessThan(2);
    const link = grid.getByRole('link', { name: names[0] });
    await expect(link).toHaveAttribute('href', '/catalog?category=e2e-flowers');
    const img = (await link.locator('img').boundingBox())!;
    const label = (await link.getByText(names[0]!, { exact: true }).boundingBox())!;
    expect(label.y).toBeGreaterThan(img.y + img.height - 1);
    const { violations } = await new AxeBuilder({ page: store })
      .include('[data-testid="category-grid"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);

    // נייד: 2 בשורה ויחס 2:1
    const mctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'he-IL' });
    const m = await mctx.newPage();
    await m.goto(`${SHOP}/`);
    const items = m.getByTestId('category-grid').locator('li');
    const [b0, b1] = [(await items.nth(0).boundingBox())!, (await items.nth(1).boundingBox())!];
    expect(Math.abs(b0.y - b1.y)).toBeLessThan(2);
    expect(Math.abs(b0.width - b1.width)).toBeLessThan(2);
    const frame = (await m.getByTestId('category-grid').getByRole('link', { name: names[0] }).locator('span').first().boundingBox())!;
    expect(Math.abs(frame.width / frame.height - 2)).toBeLessThan(0.1);
    await mctx.close();

    // חזרה לתצוגה הרגילה, כדי לא להשפיע על בדיקות אחרות בחנות הזו
    await page.getByRole('button', { name: 'חזרה לתצוגה הרגילה' }).click();
    await expect(page.getByText('החנות חזרה לתצוגה הרגילה')).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
