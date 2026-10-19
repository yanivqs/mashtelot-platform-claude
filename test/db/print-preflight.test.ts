/**
 * PT-09 (חלקי): פרופיל ייצור בגרסת תבנית (נעול אחרי פרסום), בדיקת קובץ בעת הרישום (נעולה),
 * ושער השחרור חוסם קובץ ייצור עם ממצא קריטי. ה-Snapshot כולל את תוצאת הבדיקה.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createDraftFromLatest, createTemplate, createTemplateOrder, publishDraft, saveDraft } from '@/lib/print-templates-admin';
import { addArtworkVersion, attachProof, decideArtwork, profileFor, registerFile } from '@/lib/print-artwork';
import { approveOrderSpec, gateFor, releaseOrder, setProductionFile } from '@/lib/print-production';
import { newStorageKey } from '@/lib/print-storage';
import type { PreflightResult, ProductionProfile } from '@/lib/print-preflight';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const templateIds: string[] = [];
const PROFILE = { widthMm: 100, heightMm: 50, bleedMm: 3, minDpi: 300 };
const pt = (mm: number) => ((mm * 72) / 25.4).toFixed(2);
const pdf = (w: number, h: number) => Buffer.from(`%PDF-1.7\n1 0 obj << /Type /Page /MediaBox [0 0 ${pt(w)} ${pt(h)}] >> endobj\n`);
const FIELDS = [{ key: 'text', label: 'טקסט', type: 'text', required: true }];
const PRICING = { basePrice: 5, tiers: [], setupFee: 0, minQuantity: 1, quoteOnly: false };

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.printOrder.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await prisma.printTemplate.deleteMany({ where: { id: { in: templateIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function publishedWithProfile(production: unknown) {
  const t = await createTemplate(prisma, { title: `שלט ${templateIds.length}`, description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, isActive: false }, null);
  templateIds.push(t.id);
  expect(await saveDraft(prisma, t.id, { fields: FIELDS, pricing: PRICING, production })).toEqual({ ok: true });
  expect((await publishDraft(prisma, t.id, 's@x')).ok).toBe(true);
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true } });
  return prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, status: 'PUBLISHED' } });
}

const file = async (nurseryId: string, kind: 'ARTWORK' | 'PROOF' | 'PRODUCTION', bytes: Buffer, profile?: ProductionProfile | null) =>
  ((await registerFile(prisma, { nurseryId, kind, storageKey: newStorageKey(nurseryId, kind), originalName: `${kind}.pdf`, bytes, actorEmail: null, profile })) as { fileId: string }).fileId;

describe('PT-09 production profile on template versions', () => {
  it('validated on save, copied to the next draft, immutable once published', async () => {
    const t = await createTemplate(prisma, { title: 'פרופיל', description: null, category: null, imageUrl: null, unitLabel: null, leadTimeDays: null, isActive: false }, null);
    templateIds.push(t.id);
    expect(await saveDraft(prisma, t.id, { fields: FIELDS, pricing: PRICING, production: { widthMm: 100, heightMm: 50, minDpi: 10 } })).toMatchObject({ ok: false });
    expect(await saveDraft(prisma, t.id, { fields: FIELDS, pricing: PRICING, production: PROFILE })).toEqual({ ok: true });
    await publishDraft(prisma, t.id, null);
    const v1 = await prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, version: 1 } });
    expect(v1.production).toEqual(PROFILE);
    await expect(prisma.printTemplateVersion.update({ where: { id: v1.id }, data: { production: { ...PROFILE, widthMm: 200 } } })).rejects.toThrow(/immutable/);

    expect(await createDraftFromLatest(prisma, t.id, null)).toEqual({ ok: true });
    const v2 = await prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId: t.id, version: 2 } });
    expect(v2.production).toEqual(PROFILE);
    // ניקוי הפרופיל בטיוטה
    expect(await saveDraft(prisma, t.id, { fields: FIELDS, pricing: PRICING, production: null })).toEqual({ ok: true });
    expect((await prisma.printTemplateVersion.findUniqueOrThrow({ where: { id: v2.id } })).production).toBeNull();
  });
});

describe('PT-09 preflight on registered files', () => {
  it('stored at registration; the result and content are immutable', async () => {
    const id = await file(f.A.nurseryId, 'ARTWORK', pdf(210, 297), PROFILE);
    const row = await prisma.printFile.findUniqueOrThrow({ where: { id } });
    expect((row.preflight as unknown as PreflightResult).critical[0]).toContain('אינן תואמות');
    await expect(prisma.printFile.update({ where: { id }, data: { preflight: { critical: [], warnings: [], info: {} } } })).rejects.toThrow(/immutable/);
    await expect(prisma.printFile.update({ where: { id }, data: { sha256: 'c'.repeat(64) } })).rejects.toThrow(/immutable/);
    // בלי פרופיל מועבר (הגהה) — אין בדיקה
    const proof = await file(f.A.nurseryId, 'PROOF', pdf(210, 297));
    expect((await prisma.printFile.findUniqueOrThrow({ where: { id: proof } })).preflight).toBeNull();
  });

  it('profileFor resolves the order item template version; mixed profiles → none', async () => {
    const v = await publishedWithProfile(PROFILE);
    const r = await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v.id, values: { text: 'x' }, quantity: 2 });
    expect(r.ok).toBe(true);
    const orderId = (r as { orderId: string }).orderId;
    expect(await profileFor(prisma, { printOrderId: orderId })).toEqual(PROFILE);
    const other = await publishedWithProfile({ widthMm: 30, heightMm: 30 });
    await prisma.printOrderItem.create({ data: { printOrderId: orderId, templateVersionId: other.id, title: 'אחר', quantity: 1, unitPrice: '1.00' } });
    expect(await profileFor(prisma, { printOrderId: orderId })).toBeNull();
  });
});

describe('PT-09 release gate uses the preflight', () => {
  it('a wrong-size production file blocks release; a matching one releases and is snapshotted', async () => {
    const v = await publishedWithProfile(PROFILE);
    const r = await createTemplateOrder(prisma, { nurseryId: f.A.nurseryId, userId: null, templateVersionId: v.id, values: { text: 'x' }, quantity: 2 });
    const id = (r as { orderId: string }).orderId;
    await approveOrderSpec(prisma, id, 's@x');
    const art = await addArtworkVersion(prisma, { nurseryId: f.A.nurseryId, subject: { printOrderId: id }, fileId: await file(f.A.nurseryId, 'ARTWORK', pdf(106, 56), PROFILE), actorEmail: null });
    const artId = (art as { versionId: string }).versionId;
    await attachProof(prisma, { versionId: artId, fileId: await file(f.A.nurseryId, 'PROOF', pdf(106, 56)), actorEmail: null });
    await decideArtwork(prisma, { versionId: artId, approve: true, method: 'OWNER', nurseryId: f.A.nurseryId, actorEmail: 'o@x' });

    const profile = await profileFor(prisma, { printOrderId: id });
    await setProductionFile(prisma, id, await file(f.A.nurseryId, 'PRODUCTION', pdf(210, 297), profile));
    const gate = (await gateFor(prisma, id, true))!;
    expect(gate.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(['preflight']);
    expect(await releaseOrder(prisma, id, 's@x', true)).toMatchObject({ ok: false });

    // קובץ מתוקן מחליף — השער נפתח
    await setProductionFile(prisma, id, await file(f.A.nurseryId, 'PRODUCTION', pdf(106, 56), profile));
    expect((await gateFor(prisma, id, true))!.ok).toBe(true);
    expect(await releaseOrder(prisma, id, 's@x', true)).toEqual({ ok: true });
    const o = await prisma.printOrder.findUniqueOrThrow({ where: { id } });
    expect((o.releaseSnapshot as unknown as { preflight: PreflightResult }).preflight.critical).toEqual([]);
  });
});
