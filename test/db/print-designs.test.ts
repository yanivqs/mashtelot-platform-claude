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
import { GREETING_CARDS_LARGE_RULE, GREETING_CARDS_MEDIUM_RULE, GREETING_CARDS_RULE, type DesignRule } from '@/lib/print-designs';
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

async function cardsProduct(designs = 17, rule: DesignRule = GREETING_CARDS_RULE, unitPrice = 0.4) {
  const t = await createTemplate(prisma, { title: `כרטיסים ${templateIds.length}`, description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, requiresArtwork: false, isActive: false }, null);
  templateIds.push(t.id);
  await saveDraft(prisma, t.id, { fields: FIELDS, pricing: { ...PRICING, basePrice: unitPrice } });
  await publishDraft(prisma, t.id, null);
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true, designRule: { ...rule } } });
  for (let i = 0; i < designs; i += 1) {
    const r = await saveDesign(prisma, t.id, null, { code: `SC${100 + i}`, title: `דוגמא ${i}`, imageUrl: 'https://x.example/a.jpg', tags: [], sortOrder: i, isActive: true });
    if (!r.ok) throw new Error(r.error);
  }
  const v = await prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, status: 'PUBLISHED' } });
  const ds = await prisma.printDesign.findMany({ where: { templateId: t.id }, orderBy: { sortOrder: 'asc' } });
  return { templateId: t.id, versionId: v.id, ids: ds.map((d) => d.id) };
}

const base = (nurseryId = f.A.nurseryId) => ({ nurseryId, userId: null, actorEmail: 'a@x', values: { business_details: 'משתלה · 03' } });
const items = (ids: string[], q: number | number[]) => ids.map((id, i) => ({ id, quantity: Array.isArray(q) ? q[i]! : q }));

describe('createJobOrder with designs', () => {
  it('8 designs × 400: total from the server (browser quantity ignored); designs and quantities stored on the order', async () => {
    const p = await cardsProduct();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 1, designs: items(p.ids.slice(0, 8), 400) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote.quantity).toBe(3200);
    expect(r.quote.total).toBe(1280);
    const item = await prisma.printOrderItem.findFirstOrThrow({ where: { printOrderId: r.orderId } });
    expect(item.quantity).toBe(3200);
    const values = item.values as { display: Array<{ label: string; value: string }>; designs: { ids: string[]; codes: string[]; quantities: number[] } };
    expect(values.designs.codes).toEqual(['SC100', 'SC101', 'SC102', 'SC103', 'SC104', 'SC105', 'SC106', 'SC107']);
    expect(values.designs.quantities).toEqual([400, 400, 400, 400, 400, 400, 400, 400]);
    expect(values.display[0]).toMatchObject({ label: "דוגמאות (8, סה\"כ 3,200 יח')" });
    expect(values.display[0]!.value).toContain('SC100 דוגמא 0 ×400');
    expect(values.display[1]).toEqual({ label: 'פרטי עסק', value: 'משתלה · 03' });
  });

  it('different quantity per design; the rule is enforced on the server; no logo needed', async () => {
    const p = await cardsProduct();
    const mixed = [1000, 600, 400, 400, 400, 200, 200, 200];
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designs: items(p.ids.slice(0, 8), mixed) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote.quantity).toBe(3400);
    expect(r.quote.total).toBe(1360);
    const v = (id: string[], q: number | number[]) => createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 3200, designs: items(id, q) });
    expect(await v(p.ids.slice(0, 9), 400)).toMatchObject({ ok: false, error: expect.stringContaining('בכפולות של 8') });
    expect(await v(p.ids.slice(0, 7), 400)).toMatchObject({ ok: false, error: expect.stringContaining('לפחות 8') });
    expect(await v(p.ids.slice(0, 8), 300)).toMatchObject({ ok: false, error: expect.stringContaining('בקפיצות של 200') });
    expect(await v(p.ids.slice(0, 8), 200)).toMatchObject({ ok: false, error: expect.stringContaining('מינימום הזמנה לכרטיסים היא 3,200') });
    expect(await v([...p.ids.slice(0, 7), p.ids[0]!], 400)).toMatchObject({ ok: false });
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 3200, designs: null })).toMatchObject({ ok: false });
  });

  it('a design of another product, an inactive one, or one dedicated to another nursery — rejected', async () => {
    const a = await cardsProduct(9);
    const b = await cardsProduct(8);
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: a.versionId, quantity: 0, designs: items([...a.ids.slice(0, 7), b.ids[0]!], 400) })).toMatchObject({ ok: false, error: expect.stringContaining('אינן זמינות') });
    // הדוגמא התשיעית ייעודית למשתלה B
    await prisma.printDesign.update({ where: { id: a.ids[8]! }, data: { nurseryId: f.B.nurseryId } });
    const withOwn = items([...a.ids.slice(1, 8), a.ids[8]!], 400);
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: a.versionId, quantity: 0, designs: withOwn })).toMatchObject({ ok: false, error: expect.stringContaining('אינן זמינות') });
    const own = await createJobOrder(prisma, { ...base(f.B.nurseryId), templateVersionId: a.versionId, quantity: 0, designs: withOwn });
    expect(own.ok).toBe(true);
    await prisma.printDesign.update({ where: { id: a.ids[0]! }, data: { isActive: false } });
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: a.versionId, quantity: 0, designs: items(a.ids.slice(0, 8), 400) })).toMatchObject({ ok: false });
  });

  it('reorder: same designs and quantities, total recomputed (not the requested quantity)', async () => {
    const p = await cardsProduct();
    const q = [...Array<number>(15).fill(200), 600];
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designs: items(p.ids.slice(0, 16), q) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const again = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 5 });
    if (!again.ok) throw new Error(JSON.stringify(again));
    expect(again.quote.quantity).toBe(3600);
    expect(again.quote.total).toBe(1440);
    // דוגמא שהושבתה — ההזמנה החוזרת נעצרת
    await prisma.printDesign.update({ where: { id: p.ids[3]! }, data: { isActive: false } });
    expect(await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 5 })).toMatchObject({ ok: false, changed: true });
  });
});

describe('medium greeting cards', () => {
  it('11 designs of 50 (not a multiple of 10) at 1.30 ₪; 9 designs rejected', async () => {
    const p = await cardsProduct(12, GREETING_CARDS_MEDIUM_RULE, 1.3);
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designs: items(p.ids.slice(0, 11), [...Array<number>(10).fill(50), 100]) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote.quantity).toBe(600);
    expect(r.quote.total).toBe(780);
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designs: items(p.ids.slice(0, 9), 50) })).toMatchObject({ ok: false, error: expect.stringContaining('לפחות 10') });
  });
});

describe('large greeting cards', () => {
  it('12 designs of 26 at 2.50 ₪ = 312 cards, 780 ₪; 13 designs rejected (multiples of 2)', async () => {
    const p = await cardsProduct(14, GREETING_CARDS_LARGE_RULE, 2.5);
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designs: items(p.ids.slice(0, 12), 26) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote.quantity).toBe(312);
    expect(r.quote.total).toBe(780);
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: p.versionId, quantity: 0, designs: items(p.ids.slice(0, 13), 26) })).toMatchObject({ ok: false, error: expect.stringContaining('בכפולות של 2') });
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
