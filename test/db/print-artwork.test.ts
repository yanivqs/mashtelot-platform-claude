/**
 * PT-05 / PT-08: קבצים פרטיים (בדיקה לפי תוכן, כרטיסים חתומים), גרסאות גרפיקה, הגהה, אישור מפורש לגרסה.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { addArtworkVersion, attachProof, decideArtwork, registerFile } from '@/lib/print-artwork';
import { localPath, newStorageKey, signDownloadUrl, signUploadTicket, verifyDownloadToken, verifyUploadTicket } from '@/lib/print-storage';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.printOrder.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const file = (nurseryId: string, kind: 'ARTWORK' | 'PROOF', bytes: Buffer = PDF, name = 'logo.pdf') =>
  registerFile(prisma, { nurseryId, kind, storageKey: newStorageKey(nurseryId, kind), originalName: name, bytes, actorEmail: 'x@x' });

async function order(nurseryId: string) {
  return prisma.printOrder.create({ data: { nurseryId, totalAmount: '0' } });
}

describe('PT-08 files and tickets', () => {
  it('registers by content: PDF accepted with SHA-256; SVG/empty rejected; name sanitised', async () => {
    const ok = await file(f.A.nurseryId, 'ARTWORK', PDF, '../../evil/לוגו.svg');
    expect(ok.ok).toBe(true);
    const row = await prisma.printFile.findUniqueOrThrow({ where: { id: (ok as { fileId: string }).fileId } });
    expect(row).toMatchObject({ mimeType: 'application/pdf', originalName: 'לוגו.pdf', sizeBytes: PDF.length });
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(await file(f.A.nurseryId, 'ARTWORK', SVG, 'x.pdf')).toMatchObject({ ok: false });
    expect(await file(f.A.nurseryId, 'ARTWORK', Buffer.alloc(0))).toMatchObject({ ok: false });
  });

  it('tickets are signed, typed and bound to their file', async () => {
    const t = await signUploadTicket({ key: 'k', nurseryId: f.A.nurseryId, kind: 'ARTWORK', target: { printOrderId: 'o' } });
    expect(await verifyUploadTicket(t)).toMatchObject({ key: 'k', nurseryId: f.A.nurseryId, kind: 'ARTWORK' });
    expect(await verifyUploadTicket(t.slice(0, -2) + 'xx')).toBeNull();
    const url = await signDownloadUrl('file-1');
    const token = decodeURIComponent(url.split('t=')[1]!);
    expect(await verifyDownloadToken('file-1', token)).toBe(true);
    expect(await verifyDownloadToken('file-2', token)).toBe(false); // כרטיס של קובץ אחר
    expect(await verifyDownloadToken('file-1', t)).toBe(false); // כרטיס העלאה אינו כרטיס הורדה
  });

  it('local storage keys cannot escape the storage folder', () => {
    expect(() => localPath('../../etc/passwd')).toThrow();
    expect(() => localPath(`${f.A.nurseryId}/ARTWORK/../../x`)).toThrow();
    expect(localPath(newStorageKey(f.A.nurseryId, 'ARTWORK'))).toContain(f.A.nurseryId);
  });
});

describe('PT-05 artwork versions, proof and approval', () => {
  it('upload → proof → owner approves; a new upload supersedes even an approved version', async () => {
    const o = await order(f.A.nurseryId);
    const a1 = await file(f.A.nurseryId, 'ARTWORK');
    const v1 = await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: o.id }, fileId: (a1 as { fileId: string }).fileId, actorEmail: 'o@x' });
    expect(v1).toMatchObject({ ok: true, version: 1 });
    const id1 = (v1 as { versionId: string }).versionId;

    // אישור לפני הגהה — נדחה
    expect((await decideArtwork(prisma, { versionId: id1, approve: true, method: 'OWNER', nurseryId: f.A.nurseryId, actorEmail: 'o@x' })).ok).toBe(false);
    const p1 = await file(f.A.nurseryId, 'PROOF');
    expect(await attachProof(prisma, { versionId: id1, fileId: (p1 as { fileId: string }).fileId, actorEmail: 's@x' })).toEqual({ ok: true });
    expect((await attachProof(prisma, { versionId: id1, fileId: (p1 as { fileId: string }).fileId, actorEmail: 's@x' })).ok).toBe(false);

    // משתלה אחרת לא מאשרת
    expect(await decideArtwork(prisma, { versionId: id1, approve: true, method: 'OWNER', nurseryId: f.B.nurseryId, actorEmail: 'b@x' })).toEqual({ ok: false, error: 'הגרסה לא נמצאה' });
    expect(await decideArtwork(prisma, { versionId: id1, approve: true, method: 'OWNER', nurseryId: f.A.nurseryId, actorEmail: 'o@x' })).toEqual({ ok: true });
    expect(await prisma.printArtworkVersion.findUniqueOrThrow({ where: { id: id1 } })).toMatchObject({ status: 'APPROVED', approvalMethod: 'OWNER', approvedBy: 'o@x' });

    const a2 = await file(f.A.nurseryId, 'ARTWORK');
    const v2 = await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: o.id }, fileId: (a2 as { fileId: string }).fileId, actorEmail: 'o@x' });
    expect(v2).toMatchObject({ ok: true, version: 2 });
    expect((await prisma.printArtworkVersion.findUniqueOrThrow({ where: { id: id1 } })).status).toBe('SUPERSEDED');
  });

  it('a superseded (stale) proof cannot be approved; rejection and phone decisions need a note', async () => {
    const o = await order(f.A.nurseryId);
    const v1 = await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: o.id }, fileId: ((await file(f.A.nurseryId, 'ARTWORK')) as { fileId: string }).fileId, actorEmail: null });
    const id1 = (v1 as { versionId: string }).versionId;
    await attachProof(prisma, { versionId: id1, fileId: ((await file(f.A.nurseryId, 'PROOF')) as { fileId: string }).fileId, actorEmail: null });
    await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: o.id }, fileId: ((await file(f.A.nurseryId, 'ARTWORK')) as { fileId: string }).fileId, actorEmail: null });
    expect((await decideArtwork(prisma, { versionId: id1, approve: true, method: 'OWNER', nurseryId: f.A.nurseryId, actorEmail: null })).ok).toBe(false);

    const v3 = await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: o.id }, fileId: ((await file(f.A.nurseryId, 'ARTWORK')) as { fileId: string }).fileId, actorEmail: null });
    const id3 = (v3 as { versionId: string }).versionId;
    await attachProof(prisma, { versionId: id3, fileId: ((await file(f.A.nurseryId, 'PROOF')) as { fileId: string }).fileId, actorEmail: null });
    expect(await decideArtwork(prisma, { versionId: id3, approve: false, method: 'OWNER', nurseryId: f.A.nurseryId, actorEmail: null })).toEqual({ ok: false, error: 'בדחייה יש לכתוב מה לתקן' });
    expect((await decideArtwork(prisma, { versionId: id3, approve: true, method: 'PHONE', actorEmail: 's@x' })).ok).toBe(false);
    expect(await decideArtwork(prisma, { versionId: id3, approve: true, method: 'PHONE', actorEmail: 's@x', note: 'אושר טלפונית ע״י דני' })).toEqual({ ok: true });
    expect(await prisma.printArtworkVersion.findUniqueOrThrow({ where: { id: id3 } })).toMatchObject({ approvalMethod: 'PHONE', decisionNote: 'אושר טלפונית ע״י דני' });
  });

  it('DB guard: file and approval are immutable; invalid transitions blocked', async () => {
    const o = await order(f.A.nurseryId);
    const v = await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: o.id }, fileId: ((await file(f.A.nurseryId, 'ARTWORK')) as { fileId: string }).fileId, actorEmail: null });
    const id = (v as { versionId: string }).versionId;
    const other = ((await file(f.A.nurseryId, 'ARTWORK')) as { fileId: string }).fileId;
    await expect(prisma.printArtworkVersion.update({ where: { id }, data: { fileId: other } })).rejects.toThrow(/immutable/);
    await expect(prisma.printArtworkVersion.update({ where: { id }, data: { status: 'APPROVED' } })).rejects.toThrow(/invalid artwork status/);
    await attachProof(prisma, { versionId: id, fileId: ((await file(f.A.nurseryId, 'PROOF')) as { fileId: string }).fileId, actorEmail: null });
    await decideArtwork(prisma, { versionId: id, approve: true, method: 'OWNER', nurseryId: f.A.nurseryId, actorEmail: 'o@x' });
    await expect(prisma.printArtworkVersion.update({ where: { id }, data: { approvedBy: 'someone-else' } })).rejects.toThrow(/immutable/);
    await expect(prisma.printArtworkVersion.update({ where: { id }, data: { status: 'UPLOADED' } })).rejects.toThrow(/invalid artwork status/);
  });

  it('deleting a nursery cascades through artwork, files, fixed products and their orders', async () => {
    const n = await prisma.nursery.create({ data: { name: '[test] מחיקה', subdomain: `del-${Date.now()}`, ownerEmail: 'del@example.invalid' } });
    const t = await prisma.printTemplate.create({
      data: { title: 'מחיקה', isActive: true, versions: { create: { version: 1, status: 'PUBLISHED', fields: [], pricing: { basePrice: 1, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false } } } },
      include: { versions: true },
    });
    const sp = await prisma.printSavedProduct.create({ data: { nurseryId: n.id, templateId: t.id, name: 'x' } });
    const rev = await prisma.printSavedRevision.create({ data: { savedProductId: sp.id, nurseryId: n.id, revision: 1, templateVersionId: t.versions[0]!.id, values: {} } });
    await prisma.printOrder.create({ data: { nurseryId: n.id, totalAmount: '1', items: { create: { templateVersionId: t.versions[0]!.id, savedRevisionId: rev.id, quantity: 1, unitPrice: '1' } } } });
    const fid = ((await file(n.id, 'ARTWORK')) as { fileId: string }).fileId;
    await addArtworkVersion(prisma, { nurseryId: n.id, subject: { savedProductId: sp.id }, fileId: fid, actorEmail: null });

    await expect(prisma.nursery.delete({ where: { id: n.id } })).resolves.toBeTruthy();
    expect(await prisma.printFile.count({ where: { nurseryId: n.id } })).toBe(0);
    // קובץ שגרסה משתמשת בו לא נמחק ישירות
    const o = await order(f.A.nurseryId);
    const keep = ((await file(f.A.nurseryId, 'ARTWORK')) as { fileId: string }).fileId;
    await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: o.id }, fileId: keep, actorEmail: null });
    await expect(prisma.printFile.delete({ where: { id: keep } })).rejects.toThrow();
    await prisma.printTemplate.delete({ where: { id: t.id } });
  });

  it("nursery isolation: B cannot add artwork to A's order or use A's files", async () => {
    const o = await order(f.A.nurseryId);
    const aFile = ((await file(f.A.nurseryId, 'ARTWORK')) as { fileId: string }).fileId;
    expect(await addArtworkVersion(prisma, { nurseryId: f.B.nurseryId, subject: { printOrderId: o.id }, fileId: aFile, actorEmail: null })).toEqual({ ok: false, error: 'לא נמצא' });
    const bOrder = await order(f.B.nurseryId);
    expect(await addArtworkVersion(prisma, { nurseryId: f.B.nurseryId, subject: { printOrderId: bOrder.id }, fileId: aFile, actorEmail: null })).toEqual({ ok: false, error: 'הקובץ לא נמצא' });
  });
});
