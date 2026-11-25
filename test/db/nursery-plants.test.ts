/**
 * צמחים של בעל משתלה: צמח פרטי + מוצר (גרסה נעוצה, בלי "עדכון מהקטלוג" על שינוי של עצמו),
 * שינוי מקומי בצמח מהקטלוג (catalog_overrides, הקטלוג לא נוגע), בידוד בין משתלות, וקידום/דחייה לקטלוג.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createNurseryPlantProduct, plantFieldSuggestions, promotePlant, rejectPlantSuggestion, savePlantDetails } from '@/lib/nursery-plants';
import { pendingUpdates, restoreSyncField } from '@/lib/catalog-sync-admin';
import { localizeProduct, catalogRevisionInclude } from '@/lib/catalog-localize';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const run = Math.random().toString(36).slice(2, 8);
const plantIds: string[] = [];

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.nurseryProduct.deleteMany({ where: { plantId: { in: plantIds } } });
  await prisma.plant.deleteMany({ where: { id: { in: plantIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const product = { price: '25.00', isActive: true };

async function privatePlant(nurseryId: string, name: string, submit = true) {
  const r = await createNurseryPlantProduct(prisma, {
    nurseryId,
    fields: { hebrewName: name, light: 'שמש מלאה', water: 'מועטה', plantType: 'שיח' },
    submit,
    description: 'תיאור שלי',
    product,
    actor: 'owner@x',
  });
  if (!r.ok) throw new Error(r.error);
  plantIds.push(r.plantId);
  return r;
}

describe('nursery-owned plants', () => {
  it('creates a private plant + product pinned to its first revision', async () => {
    const r = await privatePlant(f.A.nurseryId, `לבנדר שלי ${run}`);
    const plant = await prisma.plant.findUniqueOrThrow({ where: { id: r.plantId } });
    expect(plant.ownerNurseryId).toBe(f.A.nurseryId);
    expect(plant.submittedAt).not.toBeNull();
    expect(plant.light).toBe('שמש מלאה');
    expect(plant.description).toBe('תיאור שלי');
    const p = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: r.productId }, include: { catalogRevision: true } });
    expect(p.plantId).toBe(r.plantId);
    expect(p.catalogRevision?.source).toBe('nursery');
    expect(p.catalogRevision?.actorEmail).toBe('owner@x');
  });

  it('requires a name', async () => {
    const r = await createNurseryPlantProduct(prisma, { nurseryId: f.A.nurseryId, fields: { hebrewName: null }, submit: false, product });
    expect(r.ok).toBe(false);
  });

  it('editing an own plant updates the plant and re-pins (no pending catalog update)', async () => {
    const r = await privatePlant(f.A.nurseryId, `מרווה שלי ${run}`);
    const res = await savePlantDetails(prisma, { nurseryId: f.A.nurseryId, productId: r.productId, fields: { water: 'בינונית', height: '1 מ\'' }, submit: false, actor: 'owner@x' });
    expect(res).toEqual({ ok: true, mode: 'private' });
    const plant = await prisma.plant.findUniqueOrThrow({ where: { id: r.plantId } });
    expect(plant.water).toBe('בינונית');
    expect(plant.submittedAt).toBeNull();
    const p = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: r.productId }, include: { catalogRevision: true } });
    expect(p.catalogRevision?.version).toBe(2);
    const pending = await pendingUpdates(prisma, f.A.nurseryId);
    expect(pending.some((u) => u.productId === r.productId)).toBe(false);
  });

  it('catalog plant: changes are stored locally; the master catalog is untouched; restore removes the override', async () => {
    const master = await prisma.plant.create({ data: { hebrewName: `רוזמרין ${run}`, light: 'שמש מלאה', water: 'מועטה' } });
    plantIds.push(master.id);
    const p = await prisma.nurseryProduct.create({ data: { nurseryId: f.A.nurseryId, plantId: master.id, price: '10.00' } });

    const res = await savePlantDetails(prisma, {
      nurseryId: f.A.nurseryId,
      productId: p.id,
      fields: { light: 'הצללה חלקית', water: 'מועטה', care: 'גיזום באביב' },
      actor: 'owner@x',
    });
    expect(res).toEqual({ ok: true, mode: 'local' });
    const after = await prisma.plant.findUniqueOrThrow({ where: { id: master.id } });
    expect(after.light).toBe('שמש מלאה');
    const row = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: p.id }, include: { plant: true, ...catalogRevisionInclude } });
    // ערך זהה לקטלוג (water) לא נשמר כשינוי מקומי
    expect(row.catalogOverrides).toEqual({ light: 'הצללה חלקית', care: 'גיזום באביב' });
    expect(localizeProduct(row).plant?.light).toBe('הצללה חלקית');

    const restored = await restoreSyncField(prisma, { nurseryId: f.A.nurseryId, productId: p.id, field: 'light' });
    expect(restored.ok).toBe(true);
    const row2 = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: p.id } });
    expect(row2.catalogOverrides).toEqual({ care: 'גיזום באביב' });
  });

  it('another nursery cannot edit the product, and private plants are not suggested values', async () => {
    const r = await privatePlant(f.A.nurseryId, `ייחודי ${run}`);
    const res = await savePlantDetails(prisma, { nurseryId: f.B.nurseryId, productId: r.productId, fields: { light: 'צל' } });
    expect(res.ok).toBe(false);
    await prisma.plant.update({ where: { id: r.plantId }, data: { plantType: `סוג-פרטי-${run}` } });
    const s = await plantFieldSuggestions(prisma);
    expect(s.plantType ?? []).not.toContain(`סוג-פרטי-${run}`);
  });

  it('promote moves the plant to the master catalog; reject keeps it private', async () => {
    const a = await privatePlant(f.A.nurseryId, `לקידום ${run}`);
    expect(await promotePlant(prisma, a.plantId)).toEqual({ ok: true });
    const promoted = await prisma.plant.findUniqueOrThrow({ where: { id: a.plantId } });
    expect(promoted.ownerNurseryId).toBeNull();
    expect((await promotePlant(prisma, a.plantId)).ok).toBe(false);
    // אחרי קידום — עריכה של המשתלה היא כבר שינוי מקומי
    const res = await savePlantDetails(prisma, { nurseryId: f.A.nurseryId, productId: a.productId, fields: { light: 'צל' } });
    expect(res).toEqual({ ok: true, mode: 'local' });
    expect((await prisma.plant.findUniqueOrThrow({ where: { id: a.plantId } })).light).toBe('שמש מלאה');

    const b = await privatePlant(f.A.nurseryId, `לדחייה ${run}`);
    expect(await rejectPlantSuggestion(prisma, b.plantId)).toEqual({ ok: true });
    const rejected = await prisma.plant.findUniqueOrThrow({ where: { id: b.plantId } });
    expect(rejected.ownerNurseryId).toBe(f.A.nurseryId);
    expect(rejected.submittedAt).toBeNull();
  });
});
