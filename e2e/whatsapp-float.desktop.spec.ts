import AxeBuilder from '@axe-core/playwright';
import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_FOLDER_OWNER, FIX_SHOP } from './global-setup';

test('owner turns on the floating WhatsApp button; product images are shown whole', async ({ page }) => {
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  const product = await db.nurseryProduct.create({
    data: { nurseryId: fix.id, customTitle: 'עציץ תמונה מלאה', customImageUrl: 'https://images.unsplash.com/photo-fit', price: '25.00', stockQuantity: 3 },
  });
  try {
    await page.goto(`${ADMIN}/admin/login`);
    await page.locator('input[name="email"]').fill(E2E_FOLDER_OWNER.email);
    await page.locator('input[name="password"]').fill(E2E_FOLDER_OWNER.password);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(`${ADMIN}/admin`);

    const save = async () => {
      await page.getByRole('button', { name: 'שמירת ערוצים' }).click();
      await expect(page.getByText('נשמר ✓').first()).toBeVisible();
    };

    // מספר מקומי, תיבת הכפתור הצף מסומנת
    await page.goto(`${ADMIN}/admin/settings`);
    await page.getByLabel('קישור וואטסאפ').fill('052-409-4093');
    await page.getByLabel(/כפתור וואטסאפ צף בחנות/).check();
    await save();

    await page.goto(`${FIX_SHOP}/`);
    const fab = page.getByTestId('whatsapp-float');
    await expect(fab).toBeVisible();
    const href = (await fab.getAttribute('href'))!;
    expect(href.startsWith('https://wa.me/972524094093?text=')).toBe(true);
    await expect(fab).toHaveAttribute('target', '_blank');
    // בצד הנגדי לכפתור הנגישות (ברירת מחדל: נגישות משמאל, וואטסאפ מימין)
    const vw = page.viewportSize()!.width;
    expect((await fab.boundingBox())!.x).toBeGreaterThan(vw / 2);
    expect((await page.getByTestId('a11y-open').boundingBox())!.x).toBeLessThan(vw / 2);
    const { violations } = await new AxeBuilder({ page }).include('[data-testid="whatsapp-float"]').analyze();
    expect(violations.map((v) => v.id)).toEqual([]);

    // תמונות מוצרים בקטלוג: מוצגות במלואן
    await page.goto(`${FIX_SHOP}/catalog`);
    const img = page.getByRole('img', { name: 'עציץ תמונה מלאה' }).first();
    await expect(img).toBeAttached();
    expect(await img.evaluate((el) => getComputedStyle(el).objectFit)).toBe('contain');

    // כיבוי: בלי הסימון אין כפתור, ומחיקת הערוץ מחזירה את המצב הקודם
    await page.goto(`${ADMIN}/admin/settings`);
    await page.getByLabel(/כפתור וואטסאפ צף בחנות/).uncheck();
    await save();
    await page.goto(`${FIX_SHOP}/`);
    await expect(page.getByTestId('whatsapp-float')).toHaveCount(0);

    await page.goto(`${ADMIN}/admin/settings`);
    await page.getByLabel('קישור וואטסאפ').fill('');
    await save();
  } finally {
    await db.nurseryProduct.delete({ where: { id: product.id } });
    await db.$disconnect();
  }
});
