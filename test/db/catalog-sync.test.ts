/**
 * §6 / R02-02: שינוי מרכזי אינו משנה מוצר מקומי ללא אישור; Override נשמר; מחיר ומלאי לא נדרסים.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { applySync, pendingUpdates, restoreSyncField } from '@/lib/catalog-sync-admin';
import { catalogRevisionInclude, localizeProduct } from '@/lib/catalog-localize';
import { upsertPlantRows } from '@/lib/plant-import';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const run = randomUUID().slice(0, 6);
const plantIds: string[] = [];

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.plant.deleteMany({ where: { id: { in: plantIds } } });
  await prisma.$disconnect();
});

async function newPlant(fields: Record<string, string | null> = {}) {
  const p = await prisma.plant.create({
    data: { hebrewName: `ורד ${run} ${plantIds.length}`, description: 'תיאור 1', light: 'שמש', ...fields },
  });
  plantIds.push(p.id);
  return p;
}

const adopt = (nurseryId: string, plantId: string) =>
  prisma.nurseryProduct.create({ data: { nurseryId, plantId, price: '45.00', stockQuantity: 6 } });

async function shown(productId: string) {
  const p = await prisma.nurseryProduct.findUniqueOrThrow({
    where: { id: productId },
    include: { plant: true, supply: true, ...catalogRevisionInclude },
  });
  return localizeProduct(p);
}

/** עריכה מרכזית כמו ב-catalog/[id]/actions.ts (מקור admin) */
async function centralEdit(plantId: string, data: Record<string, string | null>) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.catalog_source', 'admin', true), set_config('app.catalog_actor', 'super@x.invalid', true)`;
    await tx.plant.update({ where: { id: plantId }, data });
  });
}

describe('§6 catalog revisions', () => {
  it('central edit does not change the local product until approved; price and stock untouched', async () => {
    const plant = await newPlant();
    const product = await adopt(f.A.nurseryId, plant.id);
    await centralEdit(plant.id, { description: 'תיאור 2', light: 'חצי צל' });

    const before = await shown(product.id);
    expect(before.plant).toMatchObject({ description: 'תיאור 1', light: 'שמש' });

    const pending = (await pendingUpdates(prisma, f.A.nurseryId)).find((u) => u.productId === product.id)!;
    expect(pending).toMatchObject({ fromVersion: 1, toVersion: 2 });
    expect(pending.diffs.map((d) => d.field)).toEqual(['description', 'light']);
    const rev = await prisma.catalogRevision.findUniqueOrThrow({ where: { id: pending.toRevisionId } });
    expect(rev).toMatchObject({ source: 'admin', actorEmail: 'super@x.invalid' });

    const res = await applySync(prisma, { nurseryId: f.A.nurseryId, productId: product.id, toRevisionId: pending.toRevisionId, rejectFields: [] });
    expect(res).toEqual({ ok: true, accepted: ['description', 'light'], rejected: [] });
    const after = await shown(product.id);
    expect(after.plant).toMatchObject({ description: 'תיאור 2', light: 'חצי צל' });
    expect(after).toMatchObject({ price: expect.anything(), stockQuantity: 6 });
    expect(Number(after.price)).toBe(45);
    expect((await pendingUpdates(prisma, f.A.nurseryId)).some((u) => u.productId === product.id)).toBe(false);
  });

  it('rejected field is kept locally and not offered again; restoring brings it back', async () => {
    const plant = await newPlant();
    const product = await adopt(f.A.nurseryId, plant.id);
    await centralEdit(plant.id, { description: 'תיאור 2', light: 'צל' });
    let pending = (await pendingUpdates(prisma, f.A.nurseryId)).find((u) => u.productId === product.id)!;
    const r = await applySync(prisma, { nurseryId: f.A.nurseryId, productId: product.id, toRevisionId: pending.toRevisionId, rejectFields: ['description'] });
    expect(r).toMatchObject({ ok: true, rejected: ['description'], accepted: ['light'] });
    expect((await shown(product.id)).plant).toMatchObject({ description: 'תיאור 1', light: 'צל' });

    // שינוי נוסף בתיאור בלבד — לא מוצע; שינוי בשדה אחר — מוצע (בלי התיאור)
    await centralEdit(plant.id, { description: 'תיאור 3' });
    expect((await pendingUpdates(prisma, f.A.nurseryId)).some((u) => u.productId === product.id)).toBe(false);
    await centralEdit(plant.id, { water: 'מעט' });
    pending = (await pendingUpdates(prisma, f.A.nurseryId)).find((u) => u.productId === product.id)!;
    expect(pending.diffs.map((d) => d.field)).toEqual(['water']);

    // החזרה לסנכרון — מציג את ערך הגרסה הנעוצה
    expect((await restoreSyncField(prisma, { nurseryId: f.A.nurseryId, productId: product.id, field: 'description' })).ok).toBe(true);
    expect((await shown(product.id)).plant?.description).toBe('תיאור 2');
    const decisions = await prisma.catalogSyncDecision.findMany({ where: { nurseryProductId: product.id }, orderBy: { createdAt: 'asc' } });
    expect(decisions.map((d) => [d.accepted, d.rejected])).toEqual([[['light'], ['description']], [['description'], []]]);
  });

  it('a product adopted after the edit gets the latest version', async () => {
    const plant = await newPlant();
    await centralEdit(plant.id, { description: 'עדכני' });
    const product = await adopt(f.B.nurseryId, plant.id);
    expect((await shown(product.id)).plant?.description).toBe('עדכני');
    expect((await pendingUpdates(prisma, f.B.nurseryId)).some((u) => u.productId === product.id)).toBe(false);
  });

  it("nursery isolation: B neither sees nor applies A's proposals", async () => {
    const plant = await newPlant();
    const product = await adopt(f.A.nurseryId, plant.id);
    await centralEdit(plant.id, { description: 'ל-A' });
    const pending = (await pendingUpdates(prisma, f.A.nurseryId)).find((u) => u.productId === product.id)!;
    expect((await pendingUpdates(prisma, f.B.nurseryId)).some((u) => u.productId === product.id)).toBe(false);
    const r = await applySync(prisma, { nurseryId: f.B.nurseryId, productId: product.id, toRevisionId: pending.toRevisionId, rejectFields: [] });
    expect(r).toEqual({ ok: false, error: 'המוצר לא נמצא' });
    expect((await shown(product.id)).plant?.description).toBe('תיאור 1');
  });

  it('stale proposal (newer version exists) and double apply are refused', async () => {
    const plant = await newPlant();
    const product = await adopt(f.A.nurseryId, plant.id);
    await centralEdit(plant.id, { description: 'v2' });
    const stale = (await pendingUpdates(prisma, f.A.nurseryId)).find((u) => u.productId === product.id)!;
    await centralEdit(plant.id, { description: 'v3' });
    expect((await applySync(prisma, { nurseryId: f.A.nurseryId, productId: product.id, toRevisionId: stale.toRevisionId, rejectFields: [] })).ok).toBe(false);

    const fresh = (await pendingUpdates(prisma, f.A.nurseryId)).find((u) => u.productId === product.id)!;
    const both = await Promise.all([
      applySync(prisma, { nurseryId: f.A.nurseryId, productId: product.id, toRevisionId: fresh.toRevisionId, rejectFields: [] }),
      applySync(prisma, { nurseryId: f.A.nurseryId, productId: product.id, toRevisionId: fresh.toRevisionId, rejectFields: [] }),
    ]);
    expect(both.filter((x) => x.ok)).toHaveLength(1);
    expect(await prisma.catalogSyncDecision.count({ where: { nurseryProductId: product.id } })).toBe(1);
  });

  it('CSV import: unchanged rows create no version, changed rows create a csv version', async () => {
    const plantId = 900000 + Math.floor(Math.random() * 99999);
    const row = { plantId, hebrewName: `יבוא ${run}`, latinName: null, nickname: null, family: null, description: 'א', notes: null, origin: null, native: null, plantType: null, light: null, water: null, flowering: null, floweringSeason: null, flowerColor: null, foliage: null, evergreen: null, height: null, spacing: null, growthRate: null, climateZones: null, resistance: null, coastal: null, care: null, uniqueness: null, imageUrl: null };
    await upsertPlantRows(prisma, [row], { actorEmail: 'super@x.invalid' });
    const created = await prisma.plant.findUniqueOrThrow({ where: { plantId } });
    plantIds.push(created.id);
    await upsertPlantRows(prisma, [row], { actorEmail: 'super@x.invalid' });
    await upsertPlantRows(prisma, [{ ...row, description: 'ב' }], { actorEmail: 'super@x.invalid' });
    const revs = await prisma.catalogRevision.findMany({ where: { plantId: created.id }, orderBy: { version: 'asc' } });
    expect(revs.map((r) => [r.version, r.source])).toEqual([[1, 'csv'], [2, 'csv']]);
  });
});
