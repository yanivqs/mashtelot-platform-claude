import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { FIX_SHOP } from './global-setup';

test('long announcement wraps instead of being cut, and the sticky header stays below it', async ({ page }) => {
  const text = 'פרחי העונה הגיעו למשתלה · הזמינו באתר ואספו מהמשתלה · משלוחים לכל האזור כל השבוע';
  const db = new PrismaClient();
  const fix = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2efix' } });
  const theme = (fix.themeConfig ?? {}) as Record<string, unknown>;
  await db.nursery.update({
    where: { id: fix.id },
    data: { themeConfig: { ...theme, announcement: { enabled: true, text, href: '/catalog', linkText: 'לקטלוג', tone: 'accent' } } as Prisma.InputJsonValue },
  });
  try {
    await page.goto(`${FIX_SHOP}/catalog`);
    const bar = page.getByTestId('announcement-bar');
    const words = bar.getByText(text);
    await expect(words).toBeVisible();
    expect(await words.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    const box = (await bar.boundingBox())!;
    expect(box.height).toBeGreaterThan(40);
    await page.mouse.wheel(0, 600);
    await expect(async () => {
      const barBox = (await bar.boundingBox())!;
      const header = (await page.getByRole('banner').boundingBox())!;
      expect(header.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
    }).toPass();
  } finally {
    await db.nursery.update({ where: { id: fix.id }, data: { themeConfig: theme as Prisma.InputJsonValue } });
    await db.$disconnect();
  }
});
