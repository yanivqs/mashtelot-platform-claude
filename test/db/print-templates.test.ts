/**
 * PT-02/03/07: תבניות דפוס — גרסאות בלתי משתנות (גם ב-DB), פרסום, ולידציה ותמחור בשרת, Snapshot בהזמנה.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createDraftFromLatest, createTemplate, createTemplateOrder, publishDraft, saveDraft } from '@/lib/print-templates-admin';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const templateIds: string[] = [];

const FIELDS = [
  { key: 'material', label: 'חומר', type: 'select', required: true, options: [
    { value: 'paper', label: 'נייר', priceDelta: 0 },
    { value: 'pvc', label: 'PVC', priceDelta: 0.5 },
  ] },
  { key: 'glue', label: 'סוג דבק', type: 'select', required: true, showIf: { field: 'material', equals: 'pvc' }, options: [
    { value: 'perm', label: 'קבוע', priceDelta: 0.1 },
  ] },
  { key: 'text', label: 'טקסט', type: 'text', required: true, maxLength: 30 },
];
const PRICING = { basePrice: 1, tiers: [{ minQty: 500, unitPrice: 0.8 }], setupFee: 50, minQuantity: 100, quoteOnly: false };

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  // קודם ההזמנות (הן מגנות על הגרסאות), אחר כך התבניות
  await prisma.printOrder.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await prisma.printTemplate.deleteMany({ where: { id: { in: templateIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function publishedTemplate(pricing: object = PRICING) {
  const t = await createTemplate(prisma, { title: `מדבקות ${templateIds.length}`, description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, isActive: false }, 'super@x.invalid');
  templateIds.push(t.id);
  expect(await saveDraft(prisma, t.id, { fields: FIELDS, pricing })).toEqual({ ok: true });
  expect((await publishDraft(prisma, t.id, 'super@x.invalid')).ok).toBe(true);
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true } });
  return prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, status: 'PUBLISHED' } });
}

describe('PT-02 versions', () => {
  it('draft validation errors are returned and nothing is saved', async () => {
    const t = await createTemplate(prisma, { title: 'שגוי', description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, isActive: false }, null);
    templateIds.push(t.id);
    const r = await saveDraft(prisma, t.id, { fields: [{ key: 'Bad Key', label: '', type: 'nope' }], pricing: { basePrice: 0 } });
    expect(r.ok).toBe(false);
    expect((await prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id } })).fields).toEqual([]);
  });

  it('a published version cannot be changed (even directly in the DB), and an ordered version cannot be deleted', async () => {
    const v = await publishedTemplate();
    await expect(prisma.printTemplateVersion.update({ where: { id: v.id }, data: { pricing: { ...PRICING, basePrice: 0.01 } } })).rejects.toThrow(/immutable/);
    await expect(prisma.printTemplateVersion.update({ where: { id: v.id }, data: { status: 'DRAFT' } })).rejects.toThrow(/immutable/);
    await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v.id, values: { material: 'paper', text: 'x' }, quantity: 100 });
    await expect(prisma.printTemplateVersion.delete({ where: { id: v.id } })).rejects.toThrow();
    await expect(prisma.printTemplate.delete({ where: { id: v.templateId } })).rejects.toThrow();
    expect(await saveDraft(prisma, v.templateId, { fields: FIELDS, pricing: PRICING })).toEqual({ ok: false, errors: ['אין טיוטה לעריכה — צרו גרסה חדשה'] });
  });

  it('new version: draft copied from latest, publishing archives the previous; old orders keep their version', async () => {
    const v1 = await publishedTemplate();
    const order = await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v1.id, values: { material: 'paper', text: 'א' }, quantity: 100 });
    expect(order.ok).toBe(true);

    expect(await createDraftFromLatest(prisma, v1.templateId, null)).toEqual({ ok: true });
    expect((await createDraftFromLatest(prisma, v1.templateId, null)).ok).toBe(false); // טיוטה אחת בלבד
    expect(await saveDraft(prisma, v1.templateId, { fields: FIELDS, pricing: { ...PRICING, basePrice: 2 } })).toEqual({ ok: true });
    expect(await publishDraft(prisma, v1.templateId, null)).toMatchObject({ ok: true, version: 2 });

    const versions = await prisma.printTemplateVersion.findMany({ where: { templateId: v1.templateId }, orderBy: { version: 'asc' } });
    expect(versions.map((v) => [v.version, v.status])).toEqual([[1, 'ARCHIVED'], [2, 'PUBLISHED']]);
    // הזמנה על גרסה 1 נשארת על גרסה 1 במחיר שלה; ההזמנה על גרסה ארכיון נדחית
    const item = await prisma.printOrderItem.findFirstOrThrow({ where: { printOrderId: (order as { orderId: string }).orderId } });
    expect(item.templateVersionId).toBe(v1.id);
    expect(Number(item.unitPrice)).toBe(1);
    expect((await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v1.id, values: { material: 'paper', text: 'א' }, quantity: 100 })).ok).toBe(false);
  });
});

describe('PT-03/07 ordering', () => {
  it('server validation drops hidden fields, prices on the server and stores a snapshot', async () => {
    const v = await publishedTemplate();
    const res = await createTemplateOrder(prisma, {
      nurseryId: f.A.nurseryId,
      userId: f.A.ownerId,
      templateVersionId: v.id,
      values: { material: 'pvc', glue: 'perm', text: 'ורד', injected: 'x' },
      quantity: 500,
      notes: 'דחוף',
    });
    expect(res.ok && res.quote).toMatchObject({ unitPrice: 1.4, total: 750 }); // 0.8+0.5+0.1, 500 יח׳ + הקמה 50
    const order = await prisma.printOrder.findUniqueOrThrow({ where: { id: (res as { orderId: string }).orderId }, include: { items: true } });
    expect(order).toMatchObject({ status: 'NEW', nurseryId: f.A.nurseryId, notes: 'דחוף' });
    expect(Number(order.totalAmount)).toBe(750);
    const it = order.items[0]!;
    expect(it.values).toEqual({
      raw: { material: 'pvc', glue: 'perm', text: 'ורד' },
      display: [
        { label: 'חומר', value: 'PVC' },
        { label: 'סוג דבק', value: 'קבוע' },
        { label: 'טקסט', value: 'ורד' },
      ],
    });
    expect(it.priceBreakdown).toMatchObject({ setupFee: 50, version: 1, quoteOnly: false });

    // שדה מוסתר שנשלח — נזרק
    const r2 = await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v.id, values: { material: 'paper', glue: 'perm', text: 'ב' }, quantity: 100 });
    const it2 = await prisma.printOrderItem.findFirstOrThrow({ where: { printOrderId: (r2 as { orderId: string }).orderId } });
    expect((it2.values as { raw: object }).raw).toEqual({ material: 'paper', text: 'ב' });
  });

  it('invalid values return field errors; below minimum is refused; nothing is created', async () => {
    const v = await publishedTemplate();
    const before = await prisma.printOrder.count({ where: { nurseryId: f.B.nurseryId } });
    expect(await createTemplateOrder(prisma, { nurseryId: f.B.nurseryId, userId: null, templateVersionId: v.id, values: { material: 'pvc', text: 'x'.repeat(40) }, quantity: 100 })).toEqual({
      ok: false,
      fieldErrors: { glue: 'יש לבחור', text: 'עד 30 תווים' },
    });
    expect(await createTemplateOrder(prisma, { nurseryId: f.B.nurseryId, userId: null, templateVersionId: v.id, values: { material: 'paper', text: 'x' }, quantity: 10 })).toEqual({ ok: false, error: 'כמות מינימלית: 100' });
    expect(await prisma.printOrder.count({ where: { nurseryId: f.B.nurseryId } })).toBe(before);
  });

  it('quote-only → QUOTE_REQUESTED with no price; inactive template refused', async () => {
    const v = await publishedTemplate({ basePrice: 0, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: true });
    const r = await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v.id, values: { material: 'paper', text: 'הצעה' }, quantity: 3 });
    const o = await prisma.printOrder.findUniqueOrThrow({ where: { id: (r as { orderId: string }).orderId } });
    expect(o.status).toBe('QUOTE_REQUESTED');
    expect(Number(o.totalAmount)).toBe(0);

    await prisma.printTemplate.update({ where: { id: v.templateId }, data: { isActive: false } });
    expect((await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v.id, values: { material: 'paper', text: 'x' }, quantity: 3 })).ok).toBe(false);
  });

  it('an order item has exactly one source (legacy product or template version)', async () => {
    const o = await prisma.printOrder.create({ data: { nurseryId: f.A.nurseryId, totalAmount: '0' } });
    await expect(prisma.printOrderItem.create({ data: { printOrderId: o.id, quantity: 1, unitPrice: '1' } })).rejects.toThrow(/source_check/);
  });
});
