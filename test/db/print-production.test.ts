/**
 * PT-06: שער שחרור לייצור — מפרט + גרפיקה + קובץ ייצור עם חתימה + הרשאה; Snapshot נעול; מעברי מצב.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTemplateOrder } from '@/lib/print-templates-admin';
import { addArtworkVersion, attachProof, decideArtwork, registerFile } from '@/lib/print-artwork';
import { approveOrderSpec, gateFor, moveProduction, releaseOrder, setProductionFile } from '@/lib/print-production';
import { newStorageKey } from '@/lib/print-storage';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const templateIds: string[] = [];
const PDF = Buffer.from('%PDF-1.7\n% file\n');

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

async function template(requiresArtwork = true) {
  const t = await prisma.printTemplate.create({
    data: {
      title: `שלט ${templateIds.length}`,
      isActive: true,
      requiresArtwork,
      versions: { create: { version: 1, status: 'PUBLISHED', fields: [{ key: 'text', label: 'טקסט', type: 'text', required: true }], pricing: { basePrice: 5, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false } } },
    },
    include: { versions: true },
  });
  templateIds.push(t.id);
  return t.versions[0]!;
}

async function newOrder(nurseryId: string, requiresArtwork = true) {
  const v = await template(requiresArtwork);
  const r = await createTemplateOrder(prisma, { nurseryId, userId: null, templateVersionId: v.id, values: { text: 'x' }, quantity: 2 });
  return (r as { orderId: string }).orderId;
}

const file = async (nurseryId: string, kind: 'ARTWORK' | 'PROOF' | 'PRODUCTION') =>
  ((await registerFile(prisma, { nurseryId, kind, storageKey: newStorageKey(nurseryId, kind), originalName: `${kind}.pdf`, bytes: PDF, actorEmail: null })) as { fileId: string }).fileId;

async function approvedArtwork(nurseryId: string, orderId: string) {
  const v = await addArtworkVersion(prisma, { nurseryId, subject: { printOrderId: orderId }, fileId: await file(nurseryId, 'ARTWORK'), actorEmail: null });
  const id = (v as { versionId: string }).versionId;
  await attachProof(prisma, { versionId: id, fileId: await file(nurseryId, 'PROOF'), actorEmail: null });
  await decideArtwork(prisma, { versionId: id, approve: true, method: 'OWNER', nurseryId, actorEmail: 'o@x' });
  return id;
}

const failed = async (orderId: string) => (await gateFor(prisma, orderId, true))!.checks.filter((c) => !c.ok).map((c) => c.key).sort();

describe('PT-06 release gate', () => {
  it('opens only after spec, artwork and production file; release snapshots what was approved', async () => {
    const id = await newOrder(f.A.nurseryId);
    expect(await failed(id)).toEqual(['artwork', 'file', 'spec']);
    expect((await releaseOrder(prisma, id, 's@x', true)).ok).toBe(false);

    expect(await approveOrderSpec(prisma, id, 's@x')).toEqual({ ok: true });
    expect((await approveOrderSpec(prisma, id, 's@x')).ok).toBe(false); // כבר אושר
    const artId = await approvedArtwork(f.A.nurseryId, id);
    expect(await failed(id)).toEqual(['file']);
    const prodFile = await file(f.A.nurseryId, 'PRODUCTION');
    expect(await setProductionFile(prisma, id, prodFile)).toEqual({ ok: true });
    expect(await failed(id)).toEqual([]);
    expect((await gateFor(prisma, id, false))!.checks.find((c) => c.key === 'role')!.ok).toBe(false);
    expect((await releaseOrder(prisma, id, 'x', false)).ok).toBe(false); // בלי הרשאה

    expect(await releaseOrder(prisma, id, 's@x', true)).toEqual({ ok: true });
    expect((await releaseOrder(prisma, id, 's@x', true)).ok).toBe(false); // שחרור כפול
    const o = await prisma.printOrder.findUniqueOrThrow({ where: { id }, include: { productionFile: true } });
    expect(o).toMatchObject({ productionStatus: 'RELEASED', releasedBy: 's@x' });
    const snap = o.releaseSnapshot as { productionFile: { sha256: string }; items: Array<{ artwork: { versionId: string } }> };
    expect(snap.productionFile.sha256).toBe(o.productionFile!.sha256);
    expect(snap.items[0]!.artwork.versionId).toBe(artId);

    // אחרי שחרור: קובץ הייצור והגרפיקה נעולים
    expect((await setProductionFile(prisma, id, await file(f.A.nurseryId, 'PRODUCTION'))).ok).toBe(false);
    expect(await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: id }, fileId: await file(f.A.nurseryId, 'ARTWORK'), actorEmail: null })).toMatchObject({ ok: false });
  });

  it('DB guard: no RELEASED without a recorded release; release record is immutable', async () => {
    const id = await newOrder(f.A.nurseryId, false);
    await expect(prisma.printOrder.update({ where: { id }, data: { productionStatus: 'IN_PRODUCTION' } })).rejects.toThrow(/without a recorded release/);
    await approveOrderSpec(prisma, id, null);
    await setProductionFile(prisma, id, await file(f.A.nurseryId, 'PRODUCTION'));
    expect(await releaseOrder(prisma, id, 's@x', true)).toEqual({ ok: true }); // ללא דרישת גרפיקה
    await expect(prisma.printOrder.update({ where: { id }, data: { releaseSnapshot: { forged: true } } })).rejects.toThrow(/immutable/);
    await expect(prisma.printOrder.update({ where: { id }, data: { releasedBy: 'someone-else' } })).rejects.toThrow(/immutable/);
  });

  it('production transitions: no skipping; block needs a reason and returns to released', async () => {
    const id = await newOrder(f.A.nurseryId, false);
    expect((await moveProduction(prisma, id, 'IN_PRODUCTION')).ok).toBe(false);
    expect((await moveProduction(prisma, id, 'RELEASED')).ok).toBe(false); // לא עוקפים את השער
    await approveOrderSpec(prisma, id, null);
    await setProductionFile(prisma, id, await file(f.A.nurseryId, 'PRODUCTION'));
    await releaseOrder(prisma, id, null, true);

    expect(await moveProduction(prisma, id, 'BLOCKED')).toEqual({ ok: false, error: 'בחסימה יש לכתוב את הסיבה' });
    expect(await moveProduction(prisma, id, 'BLOCKED', 'חסר חומר גלם')).toEqual({ ok: true });
    expect((await moveProduction(prisma, id, 'PENDING')).ok).toBe(false);
    expect(await moveProduction(prisma, id, 'RELEASED')).toEqual({ ok: true });
    for (const to of ['IN_PRODUCTION', 'QC', 'COMPLETED'] as const) expect((await moveProduction(prisma, id, to)).ok, to).toBe(true);
    expect((await moveProduction(prisma, id, 'BLOCKED', 'x')).ok).toBe(false); // הושלם — סופי
  });

  it('fixed-product orders take the spec from the approved revision', async () => {
    const v = await template(false);
    const sp = await prisma.printSavedProduct.create({ data: { nurseryId: f.A.nurseryId, templateId: v.templateId, name: 'קבוע' } });
    const rev = await prisma.printSavedRevision.create({ data: { savedProductId: sp.id, nurseryId: f.A.nurseryId, revision: 1, templateVersionId: v.id, values: {} } });
    await prisma.printSavedRevision.update({ where: { id: rev.id }, data: { status: 'APPROVED' } });
    const o = await prisma.printOrder.create({ data: { nurseryId: f.A.nurseryId, totalAmount: '1', items: { create: { templateVersionId: v.id, savedRevisionId: rev.id, quantity: 1, unitPrice: '1', title: 'קבוע' } } } });
    expect(await failed(o.id)).toEqual(['file']);
  });

  it('deleting a nursery with a released order still cascades (deferred FK)', async () => {
    const n = await prisma.nursery.create({ data: { name: '[test] ייצור', subdomain: `prod-${Date.now()}`, ownerEmail: 'p@example.invalid' } });
    const id = await newOrder(n.id, false);
    await approveOrderSpec(prisma, id, null);
    await setProductionFile(prisma, id, await file(n.id, 'PRODUCTION'));
    await releaseOrder(prisma, id, null, true);
    await expect(prisma.nursery.delete({ where: { id: n.id } })).resolves.toBeTruthy();
  });
});
