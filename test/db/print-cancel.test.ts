/**
 * ביטול בידי המשתלה (רק לפני הייצור, בלי השפעה על משתלה אחרת) ומחיקה לצמיתות בידי בית הדפוס
 * (ההזמנה, הפריטים, השלטים, קבצים שלא בשימוש, והעבודה כשלא נשארה לה הזמנה).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { newStorageKey } from '@/lib/print-storage';
import { cancelNurseryOrder, canNurseryCancel, deletePrintOrder } from '@/lib/print-cancel';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
/** הזמנה ששוחררה לייצור (השער במסד דורש מועד, Snapshot וקובץ ייצור) */
const RELEASED = { releasedAt: new Date(), releaseSnapshot: {}, productionStatus: 'RELEASED' };

async function job(nurseryId: string, name: string) {
  return prisma.printSavedProduct.create({ data: { nurseryId, name } });
}

async function order(nurseryId: string, jobId: string, data: Record<string, unknown> = {}) {
  return prisma.printOrder.create({
    data: {
      nurseryId,
      totalAmount: '10.00',
      ...data,
      items: { create: [{ quantity: 1, unitPrice: '10', title: 'פריט', savedProductId: jobId }] },
    },
  });
}

async function file(nurseryId: string) {
  return prisma.printFile.create({
    data: {
      nurseryId,
      kind: 'PRODUCTION',
      storageKey: newStorageKey(nurseryId, 'PRODUCTION'),
      originalName: 'p.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      sha256: 'x',
    },
  });
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  const ids = { in: [f.A.nurseryId, f.B.nurseryId] };
  await prisma.printOrder.deleteMany({ where: { nurseryId: ids } });
  await prisma.printSavedProduct.deleteMany({ where: { nurseryId: ids } });
  await prisma.printFile.deleteMany({ where: { nurseryId: ids } });
  await destroyTenantFixtures(prisma, f);
});

describe('canNurseryCancel', () => {
  it('only new / quote orders that were not released', () => {
    expect(canNurseryCancel({ status: 'NEW', releasedAt: null, productionStatus: 'PENDING' })).toBe(true);
    expect(canNurseryCancel({ status: 'QUOTE_REQUESTED', releasedAt: null, productionStatus: 'PENDING' })).toBe(true);
    expect(canNurseryCancel({ status: 'NEW', releasedAt: new Date(), productionStatus: 'RELEASED' })).toBe(false);
    expect(canNurseryCancel({ status: 'NEW', releasedAt: null, productionStatus: 'QC' })).toBe(false);
    expect(canNurseryCancel({ status: 'IN_PRODUCTION', releasedAt: null, productionStatus: 'PENDING' })).toBe(false);
  });
});

describe('cancelNurseryOrder', () => {
  it('cancels a new order, marks who cancelled, and archives a job left without orders', async () => {
    const j = await job(f.A.nurseryId, 'ביטול');
    const o = await order(f.A.nurseryId, j.id, { status: 'QUOTE_REQUESTED', quoteStatus: 'SENT' });
    const r = await cancelNurseryOrder(prisma, { nurseryId: f.A.nurseryId, orderId: o.id, actorEmail: 'owner@x' });
    expect(r).toEqual({ ok: true, archivedJobs: [j.id] });
    const after = await prisma.printOrder.findUniqueOrThrow({ where: { id: o.id } });
    expect(after).toMatchObject({ status: 'CANCELLED', quoteStatus: 'REJECTED', cancelledBy: 'owner@x' });
    expect(after.cancelledAt).toBeInstanceOf(Date);
    expect((await prisma.printSavedProduct.findUniqueOrThrow({ where: { id: j.id } })).isArchived).toBe(true);
  });

  it('keeps a job that still has another order', async () => {
    const j = await job(f.A.nurseryId, 'עם היסטוריה');
    await order(f.A.nurseryId, j.id, { status: 'DELIVERED' });
    const o = await order(f.A.nurseryId, j.id);
    expect(await cancelNurseryOrder(prisma, { nurseryId: f.A.nurseryId, orderId: o.id, actorEmail: 'owner@x' })).toEqual({
      ok: true,
      archivedJobs: [],
    });
    expect((await prisma.printSavedProduct.findUniqueOrThrow({ where: { id: j.id } })).isArchived).toBe(false);
  });

  it('refuses a released order and an order of another nursery', async () => {
    const j = await job(f.A.nurseryId, 'בייצור');
    const pf = await file(f.A.nurseryId);
    const released = await order(f.A.nurseryId, j.id, { ...RELEASED, productionFileId: pf.id });
    expect(await cancelNurseryOrder(prisma, { nurseryId: f.A.nurseryId, orderId: released.id, actorEmail: null })).toEqual({
      ok: false,
      error: 'ההזמנה כבר בייצור — לביטול פנו לבית הדפוס',
    });
    const fresh = await order(f.A.nurseryId, j.id);
    expect(await cancelNurseryOrder(prisma, { nurseryId: f.B.nurseryId, orderId: fresh.id, actorEmail: null })).toEqual({
      ok: false,
      error: 'ההזמנה לא נמצאה',
    });
    expect((await prisma.printOrder.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe('NEW');
  });
});

describe('deletePrintOrder', () => {
  it('deletes the order, its items, signs and unused production file, and the job left without orders', async () => {
    const j = await job(f.A.nurseryId, 'מחיקה');
    const pf = await file(f.A.nurseryId);
    const o = await order(f.A.nurseryId, j.id, { ...RELEASED, productionFileId: pf.id });
    await prisma.printPlantSign.create({ data: { printOrderId: o.id, nurseryId: f.A.nurseryId, quantity: 2, sortOrder: 0, data: {} } });

    const r = await deletePrintOrder(prisma, o.id);
    expect(r).toMatchObject({ ok: true, summary: { nurseryId: f.A.nurseryId, total: 10, plantSigns: 1, files: 1, deletedJobs: [j.id] } });
    expect(await prisma.printOrder.findUnique({ where: { id: o.id } })).toBeNull();
    expect(await prisma.printOrderItem.count({ where: { printOrderId: o.id } })).toBe(0);
    expect(await prisma.printPlantSign.count({ where: { printOrderId: o.id } })).toBe(0);
    expect(await prisma.printFile.findUnique({ where: { id: pf.id } })).toBeNull();
    expect(await prisma.printSavedProduct.findUnique({ where: { id: j.id } })).toBeNull();
  });

  it('keeps the job with its other orders, and a file another order still uses', async () => {
    const j = await job(f.A.nurseryId, 'שתי הזמנות');
    const shared = await file(f.A.nurseryId);
    const keep = await order(f.A.nurseryId, j.id, { productionFileId: shared.id });
    const gone = await order(f.A.nurseryId, j.id, { productionFileId: shared.id });

    expect(await deletePrintOrder(prisma, gone.id)).toMatchObject({ ok: true, summary: { files: 0, deletedJobs: [] } });
    expect(await prisma.printOrder.findUnique({ where: { id: keep.id } })).not.toBeNull();
    expect(await prisma.printFile.findUnique({ where: { id: shared.id } })).not.toBeNull();
    expect(await prisma.printSavedProduct.findUnique({ where: { id: j.id } })).not.toBeNull();
    expect(await deletePrintOrder(prisma, gone.id)).toEqual({ ok: false, error: 'ההזמנה לא נמצאה' });
  });
});
