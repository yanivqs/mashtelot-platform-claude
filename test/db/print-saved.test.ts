/**
 * PT-04: מוצר קבוע — הגשה, דחייה עם הערה, אישור, נעילה, בקשת שינוי, הזמנה חוזרת, בידוד בין משתלות.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createDraftFromLatest, createTemplate, publishDraft, saveDraft } from '@/lib/print-templates-admin';
import { archiveSaved, orderSaved, reviewSpec, submitSpec } from '@/lib/print-saved';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const templateIds: string[] = [];
const FIELDS = [
  { key: 'text', label: 'טקסט', type: 'text', required: true, maxLength: 30 },
  { key: 'size', label: 'גודל', type: 'select', required: true, options: [
    { value: 's', label: 'קטן', priceDelta: 0 },
    { value: 'l', label: 'גדול', priceDelta: 1 },
  ] },
];

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.printOrder.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await prisma.printSavedProduct.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await prisma.printTemplate.deleteMany({ where: { id: { in: templateIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function published(basePrice = 2) {
  const t = await createTemplate(prisma, { title: `תווית ${templateIds.length}`, description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, isActive: false }, null);
  templateIds.push(t.id);
  await saveDraft(prisma, t.id, { fields: FIELDS, pricing: { basePrice, tiers: [], setupFee: 0, minQuantity: 10, quoteOnly: false } });
  await publishDraft(prisma, t.id, null);
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true } });
  return prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, status: 'PUBLISHED' } });
}

const rev = (savedProductId: string, revision: number) =>
  prisma.printSavedRevision.findUniqueOrThrow({ where: { savedProductId_revision: { savedProductId, revision } } });

describe('PT-04 saved products', () => {
  it('submit → reject with note → resubmit → approve → reorder with snapshot', async () => {
    const v = await published();
    const s = await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: 'a@x', templateVersionId: v.id, values: { text: 'ורד', size: 's' }, name: 'תווית ורד' });
    expect(s).toMatchObject({ ok: true, revision: 1 });
    const id = (s as { savedProductId: string }).savedProductId;

    expect((await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: 'a@x', templateVersionId: v.id, values: { text: 'ב', size: 's' }, savedProductId: id })).ok).toBe(false); // ממתינה כבר
    expect(await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: id, quantity: 10 })).toEqual({ ok: false, error: 'למוצר אין מפרט מאושר' });

    const r1 = await rev(id, 1);
    expect(await reviewSpec(prisma, { revisionId: r1.id, approve: false, note: '', actorEmail: 's@x' })).toEqual({ ok: false, error: 'בדחייה יש לכתוב למשתלה מה לתקן' });
    expect(await reviewSpec(prisma, { revisionId: r1.id, approve: false, note: 'הטקסט ארוך מדי לשורה', actorEmail: 's@x' })).toEqual({ ok: true });
    expect(await rev(id, 1)).toMatchObject({ status: 'REJECTED', reviewNote: 'הטקסט ארוך מדי לשורה' });

    expect(await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: 'a@x', templateVersionId: v.id, values: { text: 'ורד', size: 'l' }, savedProductId: id })).toMatchObject({ ok: true, revision: 2 });
    const r2 = await rev(id, 2);
    expect(await reviewSpec(prisma, { revisionId: r2.id, approve: true, actorEmail: 's@x' })).toEqual({ ok: true });
    expect(await reviewSpec(prisma, { revisionId: r2.id, approve: true, actorEmail: 's@x' })).toEqual({ ok: false, error: 'הבקשה כבר טופלה' });

    const o = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: id, quantity: 10, notes: 'שוב' });
    expect(o.ok && o.quote).toMatchObject({ unitPrice: 3, total: 30 }); // 2 + גדול 1
    const item = await prisma.printOrderItem.findFirstOrThrow({ where: { printOrderId: (o as { orderId: string }).orderId } });
    expect(item).toMatchObject({ savedRevisionId: r2.id, templateVersionId: v.id, title: expect.stringContaining('תווית ורד') });
    expect((item.values as { raw: object }).raw).toEqual({ text: 'ורד', size: 'l' });
  });

  it('a change request does not affect orders until approved; approval supersedes the old spec', async () => {
    const v = await published();
    const s = await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, templateVersionId: v.id, values: { text: 'א', size: 's' }, name: 'שינוי' });
    const id = (s as { savedProductId: string }).savedProductId;
    await reviewSpec(prisma, { revisionId: (await rev(id, 1)).id, approve: true, actorEmail: null });

    await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, templateVersionId: v.id, values: { text: 'ב', size: 'l' }, savedProductId: id });
    const before = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: id, quantity: 10 });
    const beforeItem = await prisma.printOrderItem.findFirstOrThrow({ where: { printOrderId: (before as { orderId: string }).orderId } });
    expect((beforeItem.values as { raw: { text: string } }).raw.text).toBe('א');

    await reviewSpec(prisma, { revisionId: (await rev(id, 2)).id, approve: true, actorEmail: null });
    expect((await rev(id, 1)).status).toBe('SUPERSEDED');
    const after = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: id, quantity: 10 });
    const afterItem = await prisma.printOrderItem.findFirstOrThrow({ where: { printOrderId: (after as { orderId: string }).orderId } });
    expect((afterItem.values as { raw: { text: string } }).raw.text).toBe('ב');
  });

  it('a spec revision cannot be edited in the DB, and only valid status transitions are allowed', async () => {
    const v = await published();
    const s = await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, templateVersionId: v.id, values: { text: 'נעול', size: 's' }, name: 'נעילה' });
    const r = await rev((s as { savedProductId: string }).savedProductId, 1);
    await expect(prisma.printSavedRevision.update({ where: { id: r.id }, data: { values: { raw: { text: 'שונה' } } } })).rejects.toThrow(/immutable/);
    await expect(prisma.printSavedRevision.update({ where: { id: r.id }, data: { status: 'SUPERSEDED' } })).rejects.toThrow(/invalid spec status/);
  });

  it('approved spec keeps its price after the template is repriced; change requests must use the published version', async () => {
    const v1 = await published(2);
    const s = await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, templateVersionId: v1.id, values: { text: 'מחיר', size: 's' }, name: 'מחיר' });
    const id = (s as { savedProductId: string }).savedProductId;
    await reviewSpec(prisma, { revisionId: (await rev(id, 1)).id, approve: true, actorEmail: null });

    await createDraftFromLatest(prisma, v1.templateId, null);
    await saveDraft(prisma, v1.templateId, { fields: FIELDS, pricing: { basePrice: 5, tiers: [], setupFee: 0, minQuantity: 10, quoteOnly: false } });
    await publishDraft(prisma, v1.templateId, null);

    const o = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: id, quantity: 10 });
    expect(o.ok && o.quote.unitPrice).toBe(2);
    expect((await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, templateVersionId: v1.id, values: { text: 'x', size: 's' }, savedProductId: id })).ok).toBe(false);
  });

  it("nursery isolation: B cannot order, change or archive A's saved product", async () => {
    const v = await published();
    const s = await submitSpec(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, templateVersionId: v.id, values: { text: 'של A', size: 's' }, name: 'של A' });
    const id = (s as { savedProductId: string }).savedProductId;
    await reviewSpec(prisma, { revisionId: (await rev(id, 1)).id, approve: true, actorEmail: null });

    expect((await orderSaved(prisma, { nurseryId: f.B.nurseryId, userId: null, savedProductId: id, quantity: 10 })).ok).toBe(false);
    expect(await submitSpec(prisma, { nurseryId: f.B.nurseryId, actorEmail: null, templateVersionId: v.id, values: { text: 'x', size: 's' }, savedProductId: id })).toEqual({ ok: false, error: 'המוצר הקבוע לא נמצא' });
    expect(await archiveSaved(prisma, f.B.nurseryId, id)).toBe(false);
    expect(await archiveSaved(prisma, f.A.nurseryId, id)).toBe(true);
    expect((await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: id, quantity: 10 })).ok).toBe(false);
  });
});
