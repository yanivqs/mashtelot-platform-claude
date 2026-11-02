/**
 * עבודות דפוס קודמות: הוספה בידי בית הדפוס, היסטוריה, הזמנה חוזרת עם מוצר ובלי מוצר, בידוד ומחיקה.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTemplate, publishDraft, saveDraft } from '@/lib/print-templates-admin';
import { orderSaved } from '@/lib/print-saved';
import { gateFor } from '@/lib/print-production';
import { decideQuote, sendQuote } from '@/lib/print-jobs';
import { addImportedArtwork, addImportedOrder, createImportedJob, deleteImportedJob, IMPORT_REVIEW_REASON, parsePastDate, reorderImportedJob, updateImportedJob } from '@/lib/print-import';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
let templateId: string;
const FIELDS = [{ key: 'paper', label: 'נייר', type: 'select', required: true, options: [{ value: 'a', label: 'כרומו', priceDelta: 0.1 }] }];
const order = (quantity = 500, price: number | null = 400) => ({ date: new Date('2026-03-15T12:00:00.000Z'), quantity, price });

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  const t = await createTemplate(prisma, { title: `מדבקה מיובאת ${Date.now()}`, description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, requiresArtwork: true, isActive: false }, null);
  templateId = t.id;
  await saveDraft(prisma, t.id, { fields: FIELDS, pricing: { basePrice: 1, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false } });
  await publishDraft(prisma, t.id, null);
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true } });
});

afterAll(async () => {
  const ids = { in: [f.A.nurseryId, f.B.nurseryId] };
  await prisma.printOrder.deleteMany({ where: { nurseryId: ids } });
  await prisma.printSavedProduct.deleteMany({ where: { nurseryId: ids } });
  await prisma.printFile.deleteMany({ where: { nurseryId: ids } });
  await prisma.printTemplate.delete({ where: { id: templateId } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const free = (name = 'שלט ישן') => createImportedJob(prisma, { nurseryId: f.A.nurseryId, actorEmail: 'super@x', name, description: 'שלט 40x30', order: order() });
const artworkFile = (nurseryId: string) =>
  prisma.printFile.create({ data: { nurseryId, kind: 'ARTWORK', storageKey: `${nurseryId}/ARTWORK/${Math.random().toString(36).slice(2)}`, originalName: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 10, sha256: 'c'.repeat(64) } });

describe('createImportedJob', () => {
  it('keeps the job and a history order with its date, quantity and price, out of the production flow', async () => {
    const r = await free();
    if (!r.ok) throw new Error(JSON.stringify(r));
    const job = await prisma.printSavedProduct.findUniqueOrThrow({ where: { id: r.savedProductId }, include: { orderItems: { include: { printOrder: true } } } });
    expect(job).toMatchObject({ templateId: null, description: 'שלט 40x30', importedBy: 'super@x' });
    expect(job.importedAt).not.toBeNull();
    const item = job.orderItems[0]!;
    expect(item).toMatchObject({ quantity: 500, title: 'שלט ישן', templateVersionId: null });
    expect(item.printOrder).toMatchObject({ imported: true, status: 'DELIVERED' });
    expect(Number(item.printOrder.totalAmount)).toBe(400);
    expect(item.printOrder.createdAt.toISOString().slice(0, 10)).toBe('2026-03-15');
  });

  it('validates the name, quantity, nursery and catalog values; price is optional', async () => {
    expect(await createImportedJob(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, name: ' ', order: order() })).toEqual({ ok: false, error: 'יש לתת שם לעבודה' });
    expect(await createImportedJob(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, name: 'א', order: order(0) })).toEqual({ ok: false, error: 'כמות לא תקינה' });
    expect(await createImportedJob(prisma, { nurseryId: 'none', actorEmail: null, name: 'א', order: order() })).toEqual({ ok: false, error: 'המשתלה לא נמצאה' });
    const bad = await createImportedJob(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, name: 'א', templateId, values: {}, order: order() });
    expect(bad).toEqual({ ok: false, fieldErrors: { paper: 'יש לבחור' } });
    expect((await createImportedJob(prisma, { nurseryId: f.A.nurseryId, actorEmail: null, name: 'בלי מחיר', order: order(10, null) })).ok).toBe(true);
  });

  it('past dates only', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    expect(parsePastDate('2026-05-31', now)?.toISOString().slice(0, 10)).toBe('2026-05-31');
    expect(parsePastDate('2026-06-20', now)).toBeNull();
    expect(parsePastDate('2026-02-31', now)).toBeNull();
    expect(parsePastDate('', now)).toBeNull();
  });
});

describe('reorder', () => {
  it('with a catalog product: priced by the price list; the imported artwork needs no new proof', async () => {
    const r = await createImportedJob(prisma, { nurseryId: f.A.nurseryId, actorEmail: 'super@x', name: 'מדבקה', templateId, values: { paper: 'a' }, order: order(100, 50) });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const file = await artworkFile(f.A.nurseryId);
    expect((await addImportedArtwork(prisma, { savedProductId: r.savedProductId, fileId: file.id, actorEmail: 'super@x' })).ok).toBe(true);
    const again = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 100 });
    if (!again.ok) throw new Error(again.error);
    expect(again.quote.total).toBe(110); // (1 + 0.1) × 100
    const gate = await gateFor(prisma, again.orderId, true);
    expect(gate?.checks.find((c) => c.key === 'spec')?.ok).toBe(true);
    expect(gate?.checks.find((c) => c.key === 'artwork')?.ok).toBe(true);
  });

  it('without a product: becomes a quote request, then a real order when approved', async () => {
    const r = await free('שלט להזמנה');
    if (!r.ok) throw new Error('import failed');
    const again = await reorderImportedJob(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 20, notes: 'דחוף' });
    if (!again.ok) throw new Error(again.error);
    const o = await prisma.printOrder.findUniqueOrThrow({ where: { id: again.orderId }, include: { items: true } });
    expect(o).toMatchObject({ status: 'QUOTE_REQUESTED', quoteStatus: 'NEW', imported: false, notes: 'דחוף', reviewReasons: [IMPORT_REVIEW_REASON] });
    expect(o.items[0]).toMatchObject({ savedProductId: r.savedProductId, quantity: 20 });
    expect((await sendQuote(prisma, { orderId: o.id, total: 300 })).ok).toBe(true);
    expect((await decideQuote(prisma, { orderId: o.id, nurseryId: f.A.nurseryId, approve: true })).ok).toBe(true);
    expect(await prisma.printOrder.findUniqueOrThrow({ where: { id: o.id } })).toMatchObject({ status: 'NEW', quoteStatus: 'APPROVED' });
  });

  it('nursery isolation: B cannot reorder A\'s job, and a file of B cannot attach to it', async () => {
    const r = await free('של A');
    if (!r.ok) throw new Error('import failed');
    expect((await reorderImportedJob(prisma, { nurseryId: f.B.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 1 })).ok).toBe(false);
    const other = await artworkFile(f.B.nurseryId);
    expect((await addImportedArtwork(prisma, { savedProductId: r.savedProductId, fileId: other.id, actorEmail: null })).ok).toBe(false);
  });
});

describe('managing a job', () => {
  it('adds history orders and edits details; a job that was not imported is refused', async () => {
    const r = await free('לעריכה');
    if (!r.ok) throw new Error('import failed');
    expect((await addImportedOrder(prisma, r.savedProductId, order(30, 90))).ok).toBe(true);
    expect((await addImportedOrder(prisma, r.savedProductId, order(-1))).ok).toBe(false);
    expect(await prisma.printOrderItem.count({ where: { savedProductId: r.savedProductId } })).toBe(2);
    expect((await updateImportedJob(prisma, r.savedProductId, { name: 'שם חדש', description: '' })).ok).toBe(true);
    expect(await prisma.printSavedProduct.findUniqueOrThrow({ where: { id: r.savedProductId } })).toMatchObject({ name: 'שם חדש', description: null });
    const regular = await prisma.printSavedProduct.create({ data: { nurseryId: f.A.nurseryId, templateId, name: 'רגילה' } });
    expect((await updateImportedJob(prisma, regular.id, { name: 'x' })).ok).toBe(false);
    expect((await deleteImportedJob(prisma, regular.id)).ok).toBe(false);
  });

  it('deletes a mistaken job with its history; refused after the nursery ordered from it', async () => {
    const r = await free('בטעות');
    if (!r.ok) throw new Error('import failed');
    expect((await deleteImportedJob(prisma, r.savedProductId)).ok).toBe(true);
    expect(await prisma.printSavedProduct.count({ where: { id: r.savedProductId } })).toBe(0);
    expect(await prisma.printOrder.count({ where: { nurseryId: f.A.nurseryId, imported: true, items: { some: { title: 'בטעות' } } } })).toBe(0);

    const used = await free('בשימוש');
    if (!used.ok) throw new Error('import failed');
    await reorderImportedJob(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: used.savedProductId, quantity: 1 });
    expect((await deleteImportedJob(prisma, used.savedProductId)).ok).toBe(false);
  });
});
