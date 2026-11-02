/**
 * עבודות דפוס: יצירת עבודה עם הזמנה, מסלול בדיקה, הצעת מחיר, הזמנה חוזרת, בידוד בין משתלות.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createDraftFromLatest, createTemplate, publishDraft, saveDraft } from '@/lib/print-templates-admin';
import { createJobOrder, decideQuote, removeOrphanDraftFiles, renameJob, saveThumbnail, sendQuote, updateQuote } from '@/lib/print-jobs';
import { orderSaved, reviewSpec } from '@/lib/print-saved';
import { gateFor } from '@/lib/print-production';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const templateIds: string[] = [];
const FIELDS = [
  { key: 'paper', label: 'נייר', type: 'select', required: true, options: [
    { value: 'chromo', label: 'כרומו', priceDelta: 0.1 },
    { value: 'special', label: 'מיוחד', requiresQuote: true },
  ] },
  { key: 'size', label: 'מידה', type: 'select', required: false, options: [{ value: 'a4', label: 'A4' }] },
];
const PRICING = { basePrice: 0, tiers: [{ minQty: 500, unitPrice: 0.5 }], setupFee: 50, minQuantity: 1, quoteOnly: false, quantityOptions: [500, 1000], allowCustomQuantity: true };

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  const ids = { in: [f.A.nurseryId, f.B.nurseryId] };
  await prisma.printOrder.deleteMany({ where: { nurseryId: ids } });
  await prisma.printSavedProduct.deleteMany({ where: { nurseryId: ids } });
  await prisma.printFile.deleteMany({ where: { nurseryId: ids } });
  await prisma.printTemplate.deleteMany({ where: { id: { in: templateIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function published(requiresArtwork = true) {
  const t = await createTemplate(prisma, { title: `מדבקה ${templateIds.length}`, description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, requiresArtwork, isActive: false }, null);
  templateIds.push(t.id);
  await saveDraft(prisma, t.id, { fields: FIELDS, pricing: PRICING });
  await publishDraft(prisma, t.id, null);
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true } });
  return prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, status: 'PUBLISHED' } });
}

const artworkFile = (nurseryId: string, widthPx: number | null = null, heightPx: number | null = null, createdAt?: Date) =>
  prisma.printFile.create({
    data: {
      nurseryId,
      kind: 'ARTWORK',
      storageKey: `${nurseryId}/ARTWORK/${Math.random().toString(36).slice(2)}`,
      originalName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      sha256: 'x'.repeat(64),
      widthPx,
      heightPx,
      ...(createdAt ? { createdAt } : {}),
    },
  });

const base = () => ({ nurseryId: f.A.nurseryId, userId: null, actorEmail: 'a@x' });

describe('createJobOrder', () => {
  it('instant price: job, approved spec, artwork on the job, order with the price', async () => {
    const v = await published();
    const file = await artworkFile(f.A.nurseryId);
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo', size: 'a4' }, quantity: 1000, fileId: file.id });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote.total).toBe(650);
    expect(r.name).toContain('A4');
    const job = await prisma.printSavedProduct.findUniqueOrThrow({ where: { id: r.savedProductId }, include: { activeRevision: true, artworks: { include: { versions: true } } } });
    expect(job.activeRevision?.status).toBe('APPROVED');
    expect(job.artworks[0]?.versions[0]?.fileId).toBe(file.id);
    const order = await prisma.printOrder.findUniqueOrThrow({ where: { id: r.orderId }, include: { items: true } });
    expect(order).toMatchObject({ status: 'NEW', quoteStatus: null, reviewReasons: [], needsDesign: false });
    expect(order.items[0]?.savedRevisionId).toBe(job.activeRevisionId);
    const gate = await gateFor(prisma, r.orderId, true);
    expect(gate?.checks.find((c) => c.key === 'spec')?.ok).toBe(true);
    expect(gate?.checks.find((c) => c.key === 'artwork')?.ok).toBe(false);
  });

  it('review: no price, reasons kept, spec waits for the print house', async () => {
    const v = await published();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'special' }, quantity: 750, needsDesign: true });
    if (!r.ok) throw new Error(JSON.stringify(r));
    expect(r.quote).toMatchObject({ quoteOnly: true, total: 0 });
    const order = await prisma.printOrder.findUniqueOrThrow({ where: { id: r.orderId } });
    expect(order).toMatchObject({ status: 'QUOTE_REQUESTED', quoteStatus: 'NEW', needsDesign: true });
    expect(order.reviewReasons).toEqual(['כמות מותאמת אישית', 'נייר: מיוחד', 'נדרש עיצוב']);
    expect(Number(order.totalAmount)).toBe(0);
    const job = await prisma.printSavedProduct.findUniqueOrThrow({ where: { id: r.savedProductId }, include: { revisions: true } });
    expect(job.activeRevisionId).toBeNull();
    expect(job.revisions[0]?.status).toBe('SUBMITTED');
  });

  it('a low resolution file goes to review; a good one does not', async () => {
    const v = await published();
    const low = await artworkFile(f.A.nurseryId, 1240, 1754);
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo', size: 'a4' }, quantity: 500, fileId: low.id });
    expect(r.ok && r.quote.reasons).toEqual(['רזולוציית הקובץ נמוכה מ-300 DPI']);
    const good = await artworkFile(f.A.nurseryId, 2480, 3508);
    const g = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo', size: 'a4' }, quantity: 500, fileId: good.id });
    expect(g.ok && g.quote.quoteOnly).toBe(false);
  });

  it('blocks sending without a file, required fields or quantity, and rejects another nursery file', async () => {
    const v = await published();
    const noFile = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo' }, quantity: 500 });
    expect(noFile).toEqual({ ok: false, missing: ['יש להעלות קובץ, או לסמן שצריך גם עיצוב'] });
    const noField = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: {}, quantity: 500, needsDesign: true });
    expect(noField.ok === false && noField.fieldErrors).toEqual({ paper: 'יש לבחור' });
    const other = await artworkFile(f.B.nurseryId);
    expect(await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo' }, quantity: 500, fileId: other.id })).toEqual({ ok: false, error: 'הקובץ לא נמצא — העלו אותו שוב' });
    const before = await prisma.printOrder.count({ where: { nurseryId: f.A.nurseryId } });
    expect(before).toBeGreaterThan(0);
    const noArtworkNeeded = await published(false);
    expect((await createJobOrder(prisma, { ...base(), templateVersionId: noArtworkNeeded.id, values: { paper: 'chromo' }, quantity: 500 })).ok).toBe(true);
  });
});

describe('reorder from a job', () => {
  it('reprices by the published version, keeps the approved artwork; a changed product is refused', async () => {
    const v = await published();
    const file = await artworkFile(f.A.nurseryId);
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo' }, quantity: 500, fileId: file.id });
    if (!r.ok) throw new Error('order failed');
    const versions = await prisma.printArtworkVersion.findMany({ where: { artwork: { savedProductId: r.savedProductId } } });
    await prisma.printArtworkVersion.update({ where: { id: versions[0]!.id }, data: { status: 'PROOF_SENT' } });
    await prisma.printArtworkVersion.update({ where: { id: versions[0]!.id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: 'a@x', approvalMethod: 'OWNER' } });

    await createDraftFromLatest(prisma, v.templateId, null);
    await saveDraft(prisma, v.templateId, { fields: FIELDS, pricing: { ...PRICING, setupFee: 100 } });
    await publishDraft(prisma, v.templateId, null);
    const again = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 500 });
    if (!again.ok) throw new Error(again.error);
    expect(again.quote.total).toBe(400); // 100 + 0.6 × 500
    const gate = await gateFor(prisma, again.orderId, true);
    expect(gate?.checks.find((c) => c.key === 'artwork')?.ok).toBe(true);
    expect(gate?.checks.find((c) => c.key === 'spec')?.ok).toBe(true);

    await createDraftFromLatest(prisma, v.templateId, null);
    const relabeled = FIELDS.map((x) => (x.key === 'paper' ? { ...x, options: [{ value: 'chromo', label: 'כרומו מבריק', priceDelta: 0.1 }] } : x));
    await saveDraft(prisma, v.templateId, { fields: relabeled, pricing: PRICING });
    await publishDraft(prisma, v.templateId, null);
    const changed = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 500 });
    expect(changed).toMatchObject({ ok: false, changed: true });
  });

  it('a job in review cannot be reordered until the spec is approved', async () => {
    const v = await published();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'special' }, quantity: 500, needsDesign: true });
    if (!r.ok) throw new Error('order failed');
    expect((await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 500 })).ok).toBe(false);
    const rev = await prisma.printSavedRevision.findFirstOrThrow({ where: { savedProductId: r.savedProductId } });
    await reviewSpec(prisma, { revisionId: rev.id, approve: true, actorEmail: null });
    const again = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: r.savedProductId, quantity: 500 });
    expect(again.ok && again.quote.reasons).toEqual(['נייר: מיוחד']);
  });
});

describe('quote cycle', () => {
  async function requested() {
    const v = await published();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo' }, quantity: 750, needsDesign: true });
    if (!r.ok) throw new Error('order failed');
    return r.orderId;
  }

  it('new → in progress → sent → the nursery approves → a real order', async () => {
    const id = await requested();
    expect((await updateQuote(prisma, { orderId: id, intent: 'progress', adminNotes: 'בודק' })).ok).toBe(true);
    expect((await decideQuote(prisma, { orderId: id, nurseryId: f.A.nurseryId, approve: true })).ok).toBe(false);
    expect((await sendQuote(prisma, { orderId: id, total: 0 })).ok).toBe(false);
    expect((await sendQuote(prisma, { orderId: id, total: 900, validUntil: new Date(Date.now() + 86400000) })).ok).toBe(true);
    const sent = await prisma.printOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });
    expect(sent).toMatchObject({ status: 'QUOTE_REQUESTED', quoteStatus: 'SENT', adminNotes: 'בודק' });
    expect(Number(sent.items[0]?.unitPrice)).toBe(1.2);
    expect((await decideQuote(prisma, { orderId: id, nurseryId: f.B.nurseryId, approve: true })).ok).toBe(false);
    expect((await decideQuote(prisma, { orderId: id, nurseryId: f.A.nurseryId, approve: true })).ok).toBe(true);
    expect(await prisma.printOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'NEW', quoteStatus: 'APPROVED' });
    expect((await decideQuote(prisma, { orderId: id, nurseryId: f.A.nurseryId, approve: false })).ok).toBe(false);
  });

  it('an expired quote cannot be approved but can be declined; the print house can reject', async () => {
    const id = await requested();
    await sendQuote(prisma, { orderId: id, total: 500, validUntil: new Date(Date.now() - 1000) });
    expect(await decideQuote(prisma, { orderId: id, nurseryId: f.A.nurseryId, approve: true })).toEqual({ ok: false, error: 'תוקף ההצעה פג — פנו לבית הדפוס להצעה חדשה' });
    expect((await decideQuote(prisma, { orderId: id, nurseryId: f.A.nurseryId, approve: false })).ok).toBe(true);
    expect(await prisma.printOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'CANCELLED', quoteStatus: 'REJECTED' });

    const id2 = await requested();
    expect((await updateQuote(prisma, { orderId: id2, intent: 'reject' })).ok).toBe(true);
    expect(await prisma.printOrder.findUniqueOrThrow({ where: { id: id2 } })).toMatchObject({ status: 'CANCELLED', quoteStatus: 'REJECTED' });
  });
});

describe('rejecting a spec', () => {
  it('closes the open quote request made from it', async () => {
    const v = await published();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'special' }, quantity: 500, needsDesign: true });
    if (!r.ok) throw new Error('order failed');
    const rev = await prisma.printSavedRevision.findFirstOrThrow({ where: { savedProductId: r.savedProductId } });
    expect((await reviewSpec(prisma, { revisionId: rev.id, approve: false, note: 'נא לתקן', actorEmail: null })).ok).toBe(true);
    expect(await prisma.printOrder.findUniqueOrThrow({ where: { id: r.orderId } })).toMatchObject({ status: 'CANCELLED', quoteStatus: 'REJECTED' });
  });
});

describe('job housekeeping', () => {
  it('rename is limited to the owner nursery', async () => {
    const v = await published();
    const r = await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo' }, quantity: 500, needsDesign: true });
    if (!r.ok) throw new Error('order failed');
    expect(await renameJob(prisma, f.B.nurseryId, r.savedProductId, 'של B')).toBe(false);
    expect(await renameJob(prisma, f.A.nurseryId, r.savedProductId, '  ')).toBe(false);
    expect(await renameJob(prisma, f.A.nurseryId, r.savedProductId, 'תווית הלוגו')).toBe(true);
  });

  it('thumbnail accepts only a small JPEG', async () => {
    const file = await artworkFile(f.A.nurseryId);
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]).toString('base64');
    expect(await saveThumbnail(prisma, file.id, `data:image/jpeg;base64,${jpeg}`)).toBe(true);
    expect(await saveThumbnail(prisma, file.id, `data:image/jpeg;base64,${Buffer.from('<svg/>').toString('base64')}`)).toBe(false);
    expect(await saveThumbnail(prisma, file.id, 'data:image/svg+xml;base64,PHN2Zy8+')).toBe(false);
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(160 * 1024)]).toString('base64');
    expect(await saveThumbnail(prisma, file.id, `data:image/jpeg;base64,${big}`)).toBe(false);
  });

  it('orphan cleanup removes only old unattached artwork files', async () => {
    const old = new Date(Date.now() - 8 * 86400000);
    const orphan = await artworkFile(f.A.nurseryId, null, null, old);
    const fresh = await artworkFile(f.A.nurseryId);
    const usedOld = await artworkFile(f.A.nurseryId, null, null, old);
    const v = await published();
    await createJobOrder(prisma, { ...base(), templateVersionId: v.id, values: { paper: 'chromo' }, quantity: 500, fileId: usedOld.id });
    const removed: string[] = [];
    await removeOrphanDraftFiles(prisma, async (key) => removed.push(key));
    expect(removed).toContain(orphan.storageKey);
    expect(removed).not.toContain(fresh.storageKey);
    expect(removed).not.toContain(usedOld.storageKey);
    expect(await prisma.printFile.count({ where: { id: orphan.id } })).toBe(0);
  });
});
