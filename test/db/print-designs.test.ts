/**
 * מוצר עם מאגר דוגמאות (כרטיסי ברכה): הכמות נגזרת בשרת ממספר הדוגמאות, דוגמא של מוצר אחר נדחית,
 * הדוגמאות נשמרות בהזמנה, והזמנה חוזרת מחשבת שוב לפי החוק. קטגוריות: שתי רמות בלבד.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTemplate, publishDraft, saveDraft } from '@/lib/print-templates-admin';
import { createJobOrder } from '@/lib/print-jobs';
import { orderSaved } from '@/lib/print-saved';
import { deleteCategory, saveCategory, saveDesign } from '@/lib/print-catalog-admin';
import { GREETING_CARDS_RULE } from '@/lib/print-designs';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const templateIds: string[] = [];
const categoryIds: string[] = [];
const FIELDS = [{ key: 'business_details', label: 'פרטי עסק', type: 'textarea', required: true, maxLength: 500 }];
const PRICING = { basePrice: 0.4, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false, quantityOptions: [], allowCustomQuantity: true };

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  const ids = { in: [f.A.nurseryId, f.B.nurseryId] };
  await prisma.printOrder.deleteMany({ where: { nurseryId: ids } });
  await prisma.printSavedProduct.deleteMany({ where: { nurseryId: ids } });
  await prisma.printFile.deleteMany({ where: { nurseryId: ids } });
  await prisma.printTemplate.deleteMany({ where: { id: { in: templateIds } } });
  await prisma.printCategory.deleteMany({ where: { id: { in: categoryIds }, parentId: { not: null } } });
  await prisma.printCategory.deleteMany({ where: { id: { in: categoryIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function cardsProduct(designs = 17) {
  const t = await createTemplate(prisma, { title: `כרטיסים ${templateIds.length}`, description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, requiresArtwork: false, isActive: false }, null);
  templateIds.push(t.id);
  await saveDraft(prisma, t.id, { fields: FIELDS, pricing: PRICING });
  await publishDraft(prisma, t.id, null);
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true, designRule: { ...GREETING_CARDS_RULE } } });
  for (let i = 0; i < designs; i += 1) {
    const r = await saveDesign(prisma, t.id, null, { code: `SC${100 + i}`, title: `דוגמא ${i}`, imageUrl: 'https://x.example/a.jpg', tags: [], sortOrder: i, isActive: true });
    if (!r.ok) throw new Error(r.error);
  }
  const v = await prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, status: 'PUBLISHED' } });
  const ds = await prisma.printDesign.findMany({ where: { templateId: t.id }, orderBy: { sortOrder: 'asc' } });
  return { templateId: t.id, versionId: v.id, ids: ds.map((d) => d.id) };
}

const base = () => ({ nurseryId: f.A.nurseryId, userId: null, actorEmail: 'a@x', values: { business_details: 'משתלה · 03' } });

describe('createJobOrder with designs', () => {
  it('8 designs: 400 of each; the browser quantity is ignored; designs are stored on the order', async () => {
    const p = await cardsProduct();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 1, designIds: p.ids.slice(0, 8) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote.quantity).toBe(3200);
    expect(r.quote.total).toBe(1280);
    const item = await prisma.printOrderItem.findFirstOrThrow({ where: { printOrderId: r.orderId } });
    const values = item.values as { display: Array<{ label: string; value: string }>; designs: { ids: string[]; codes: string[]; perDesign: number } };
    expect(values.designs).toMatchObject({ perDesign: 400, codes: ['SC100', 'SC101', 'SC102', 'SC103', 'SC104', 'SC105', 'SC106', 'SC107'] });
    expect(values.display[0]).toMatchObject({ label: "דוגמאות (8 × 400 יח')" });
    expect(values.display[1]).toEqual({ label: 'פרטי עסק', value: 'משתלה · 03' });
  });

  it('16 designs: 200 of each; not a multiple of 8 or fewer than 8 — rejected with the rule', async () => {
    const p = await cardsProduct();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designIds: p.ids.slice(0, 16) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote.quantity).toBe(3200);
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 3200, designIds: p.ids.slice(0, 9) })).toMatchObject({ ok: false, error: expect.stringContaining('בכפולות של 8') });
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 3200, designIds: p.ids.slice(0, 7) })).toMatchObject({ ok: false, error: expect.stringContaining('לפחות 8') });
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 3200, designIds: [...p.ids.slice(0, 7), p.ids[0]!] })).toMatchObject({ ok: false });
  });

  it('a design of another product, or an inactive one, is rejected', async () => {
    const a = await cardsProduct(8);
    const b = await cardsProduct(8);
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: a.versionId, quantity: 0, designIds: [...a.ids.slice(0, 7), b.ids[0]!] })).toMatchObject({ ok: false, error: expect.stringContaining('אינן זמינות') });
    await prisma.printDesign.update({ where: { id: a.ids[0]! }, data: { isActive: false } });
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: a.versionId, quantity: 0, designIds: a.ids })).toMatchObject({ ok: false });
  });

  it('reorder: same designs, quantity recomputed by the rule (not the requested quantity)', async () => {
    const p = await cardsProduct();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designIds: p.ids.slice(0, 16) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const again = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 5 });
    if (!again.ok) throw new Error(JSON.stringify(again));
    expect(again.quote.quantity).toBe(3200);
    expect(again.quote.total).toBe(1280);
    // דוגמא שהושבתה — ההזמנה החוזרת נעצרת
    await prisma.printDesign.update({ where: { id: p.ids[3]! }, data: { isActive: false } });
    expect(await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 5 })).toMatchObject({ ok: false, changed: true });
  });
});

describe('print categories', () => {
  it('two levels only; a non-empty category cannot be deleted; duplicate codes are rejected', async () => {
    const slug = `t-${Date.now().toString(36)}`;
    const root = await saveCategory(prisma, null, { name: 'שורש', slug: `${slug}-a`, parentId: null, imageUrl: null, sortOrder: 0, isActive: true });
    if (!root.ok) throw new Error(root.error);
    categoryIds.push(root.id!);
    const child = await saveCategory(prisma, null, { name: 'ילד', slug: `${slug}-b`, parentId: root.id!, imageUrl: null, sortOrder: 0, isActive: true });
    if (!child.ok) throw new Error(child.error);
    categoryIds.push(child.id!);
    expect(await saveCategory(prisma, null, { name: 'נכד', slug: `${slug}-c`, parentId: child.id!, imageUrl: null, sortOrder: 0, isActive: true })).toMatchObject({ ok: false });
    expect(await saveCategory(prisma, null, { name: 'כפול', slug: `${slug}-a`, parentId: null, imageUrl: null, sortOrder: 0, isActive: true })).toMatchObject({ ok: false, error: expect.stringContaining('בשימוש') });
    expect(await deleteCategory(prisma, root.id!)).toMatchObject({ ok: false });

    const p = await cardsProduct(1);
    expect(await saveDesign(prisma, p.templateId, null, { code: 'sc100', title: 'כפולה', imageUrl: 'https://x.example/b.jpg', tags: [], sortOrder: 0, isActive: true })).toMatchObject({ ok: false, error: expect.stringContaining('כבר קיים') });
  });
});
