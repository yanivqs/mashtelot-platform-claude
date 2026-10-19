import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { E2E_OWNER4, E2E_PREFLIGHT_TEMPLATE, E2E_SAVED_TEMPLATE, E2E_SUPER3 } from './global-setup';

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies();
  await page.goto(`${ADMIN}/admin/login`);
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page).toHaveURL(`${ADMIN}/admin`);
}

const NOTE = 'שחרור E2E';
const pt = (mm: number) => ((mm * 72) / 25.4).toFixed(2);
const pdf = (w: number, h: number) => Buffer.from(`%PDF-1.7\n1 0 obj << /Type /Page /MediaBox [0 0 ${pt(w)} ${pt(h)}] >> endobj\n`);

/** הזמנה חד-פעמית מתבנית + גרפיקה מאושרת (מוכנה ב-DB); מפרט וקובץ ייצור — במסך. */
async function prepareOrder() {
  const db = new PrismaClient({ log: [] });
  try {
    const n = await db.nursery.findUniqueOrThrow({ where: { subdomain: 'e2eshop' } });
    const base = await db.printTemplateVersion.findFirstOrThrow({ where: { status: 'PUBLISHED', template: { title: E2E_SAVED_TEMPLATE } } });
    // מוצר עם פרופיל ייצור 100×50 מ"מ + גלישה 3 (PT-09)
    const t = await db.printTemplate.create({
      data: {
        title: E2E_PREFLIGHT_TEMPLATE,
        isActive: false,
        versions: { create: { version: 1, status: 'PUBLISHED', fields: base.fields as object, pricing: base.pricing as object, production: { widthMm: 100, heightMm: 50, bleedMm: 3, minDpi: 300 } } },
      },
      include: { versions: true },
    });
    const v = t.versions[0]!;
    const order = await db.printOrder.create({
      data: {
        nurseryId: n.id,
        totalAmount: '20.00',
        notes: NOTE,
        items: { create: { templateVersionId: v.id, title: E2E_SAVED_TEMPLATE, quantity: 10, unitPrice: '2.00', values: { raw: { text: 'שחרור', size: 's' }, display: [{ label: 'טקסט', value: 'שחרור' }] } } },
      },
    });
    const mk = (kind: 'ARTWORK' | 'PROOF') =>
      db.printFile.create({
        data: { nurseryId: n.id, kind, storageKey: `${n.id}/${kind}/${crypto.randomUUID()}`, originalName: `${kind}.pdf`, mimeType: 'application/pdf', sizeBytes: 10, sha256: 'b'.repeat(64) },
      });
    const art = await mk('ARTWORK');
    const proof = await mk('PROOF');
    const artwork = await db.printArtwork.create({ data: { nurseryId: n.id, printOrderId: order.id } });
    const ver = await db.printArtworkVersion.create({ data: { artworkId: artwork.id, nurseryId: n.id, version: 1, fileId: art.id } });
    await db.printArtworkVersion.update({ where: { id: ver.id }, data: { status: 'PROOF_SENT', proofFileId: proof.id } });
    await db.printArtworkVersion.update({ where: { id: ver.id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: E2E_OWNER4.email, approvalMethod: 'OWNER' } });
  } finally {
    await db.$disconnect();
  }
}

test('release gate in the UI: checklist, spec approval, production file, release, production states, block (PT-06)', async ({ page }) => {
  await prepareOrder();
  await login(page, E2E_SUPER3);
  await page.goto(`${ADMIN}/admin/print-orders`);
  const card = page.locator('div.rounded-xl').filter({ hasText: `הערות: ${NOTE}` }).first();

  await expect(card.getByText('ממתין לאישורים')).toBeVisible();
  await expect(card.getByRole('button', { name: 'שחרור לייצור' })).toBeDisabled();
  await expect(card.getByText('יש לאשר את מפרט ההזמנה')).toBeVisible();
  await expect(card.getByText('לא הועלה קובץ ייצור')).toBeVisible();

  await card.getByRole('button', { name: 'אישור מפרט ההזמנה' }).click();
  await expect(card.getByText('יש לאשר את מפרט ההזמנה')).toHaveCount(0);

  // קובץ בגודל A4 — בדיקת הקובץ נכשלת והשחרור חסום (PT-09)
  await card.getByLabel('העלאת קובץ ייצור').setInputFiles({ name: 'wrong.pdf', mimeType: 'application/pdf', buffer: pdf(210, 297) });
  await expect(card.getByText(/קובץ ייצור: wrong\.pdf/)).toBeVisible();
  await expect(card.getByText('נכשלה')).toBeVisible();
  await expect(card.getByText(/אינן תואמות למוצר 100×50/).first()).toBeVisible();
  await expect(card.getByRole('button', { name: 'שחרור לייצור' })).toBeDisabled();

  await card.getByLabel('החלפת קובץ ייצור').setInputFiles({ name: 'production.pdf', mimeType: 'application/pdf', buffer: pdf(106, 56) });
  await expect(card.getByText(/קובץ ייצור: production\.pdf/)).toBeVisible();
  await expect(card.getByText('תקינה')).toBeVisible();

  await expect(card.getByRole('button', { name: 'שחרור לייצור' })).toBeEnabled();
  await card.getByRole('button', { name: 'שחרור לייצור' }).click();
  await expect(card.getByText('שוחרר לייצור', { exact: true })).toBeVisible();
  await expect(card.getByText(/שוחרר .* ע״י super3@e2e\.invalid · קובץ ייצור SHA-256/)).toBeVisible();
  await expect(card.getByText(/גרסה 1/)).toBeVisible();

  await card.getByRole('button', { name: '→ בייצור' }).click();
  await expect(card.getByText('בייצור', { exact: true })).toBeVisible();

  // חסימה בלי סיבה נדחית; עם סיבה — חסום, וחזרה ל"שוחרר"
  await card.getByRole('button', { name: 'חסימה' }).click();
  await expect(card.getByText('בחסימה יש לכתוב את הסיבה')).toBeVisible();
  await card.getByLabel('סיבת חסימה').fill('המכונה בתיקון');
  await card.getByRole('button', { name: 'חסימה' }).click();
  await expect(card.getByText('המכונה בתיקון')).toBeVisible();
  await card.getByRole('button', { name: '→ שוחרר לייצור' }).click();
  await expect(card.getByText('שוחרר לייצור', { exact: true })).toBeVisible();

  // בעל המשתלה רואה את מצב הייצור
  await login(page, E2E_OWNER4);
  await page.goto(`${ADMIN}/admin/print-shop`);
  await expect(page.getByText('ייצור: שוחרר לייצור').first()).toBeVisible();
});
