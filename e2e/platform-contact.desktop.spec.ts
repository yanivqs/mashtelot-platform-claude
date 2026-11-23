import AxeBuilder from '@axe-core/playwright';
import { PrismaClient } from '@prisma/client';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';

test('landing page: "צור קשר" leads to the form; a lead is queued as an email with reply-to the sender', async ({ page }) => {
  const db = new PrismaClient({ log: [] });
  const email = `lead-${Date.now()}@e2e.invalid`;
  try {
    await page.goto(`${ADMIN}/`);
    await expect(page.getByRole('link', { name: 'פתחו חנות למשתלה' })).toHaveCount(0);
    await page.getByRole('link', { name: 'צור קשר' }).click();
    await expect(page).toHaveURL(/#contact$/);
    const form = page.locator('#contact');
    await expect(form.getByRole('heading', { name: 'רוצים חנות למשתלה שלכם?' })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).include('#contact').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

    await form.getByLabel(/שם איש קשר/).fill('דנה בדיקה');
    await form.getByLabel(/שם המשתלה/).fill('משתלת בדיקה');
    await form.getByLabel(/טלפון/).fill('123');
    await form.getByLabel(/אימייל/).fill(email);
    await form.getByRole('button', { name: 'שליחה' }).click();
    await expect(form.getByRole('alert')).toHaveText('מספר הטלפון אינו תקין');

    await form.getByLabel(/טלפון/).fill('050-1234567');
    await form.getByLabel('הערות').fill('מעוניינים בחנות');
    await form.getByRole('button', { name: 'שליחה' }).click();
    await expect(page.getByTestId('lead-sent')).toContainText('תודה! הפרטים התקבלו');

    const job = await db.emailJob.findFirstOrThrow({ where: { kind: 'platform_lead', replyTo: email } });
    expect(job.subject).toBe('פנייה חדשה מאתר הפלטפורמה: משתלת בדיקה');
    expect(job.html).toContain('050-1234567');
    expect(job.html).toContain('מעוניינים בחנות');
    expect(job.to.length).toBe(1);
  } finally {
    await db.emailJob.deleteMany({ where: { kind: 'platform_lead', replyTo: email } });
    await db.$disconnect();
  }
});
