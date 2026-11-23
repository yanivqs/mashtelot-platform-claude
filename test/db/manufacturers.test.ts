/**
 * ספקים ויצרנים: שמירת יצרן (שינוי שם מעדכן את brand במוצרי הקטלוג), מוצר ציוד עם קוד יצרן, ברקוד ומחיר מומלץ,
 * ומשיכה מרובה למשתלה — מחיר מומלץ, ברקוד בווריאנט ברירת המחדל, דילוג על קיים, התנגשות ברקוד ובידוד בין משתלות.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  deleteManufacturer,
  deleteSupply,
  parseProductManufacturer,
  pullSupplies,
  saveManufacturer,
  saveSupply,
  setDefaultVariantCodes,
} from '@/lib/manufacturers-admin';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const manufacturerIds: string[] = [];
const supplyIds: string[] = [];
const run = Math.random().toString(36).slice(2, 8);

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.nurseryProduct.deleteMany({
    where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] }, OR: [{ supplyId: { in: supplyIds } }, { customTitle: { in: [`שלי ${run}`, `מוצר ${run}`] } }] },
  });
  await prisma.masterSupply.deleteMany({ where: { id: { in: supplyIds } } });
  await prisma.manufacturer.deleteMany({ where: { id: { in: manufacturerIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function manufacturer(name: string, isActive = true) {
  const r = await saveManufacturer(prisma, null, { name, logoUrl: null, website: '', description: '', isActive }, 'test@x');
  if (!r.ok) throw new Error(r.error);
  manufacturerIds.push(r.id!);
  return r.id!;
}

async function supply(title: string, manufacturerId: string | null, extra: Partial<{ barcode: string; suggestedPrice: string; manufacturerCode: string }> = {}) {
  const r = await saveSupply(
    prisma,
    null,
    { title, manufacturerId, manufacturerCode: extra.manufacturerCode ?? '', barcode: extra.barcode ?? '', category: 'TOOLS', description: '', imageUrl: null, suggestedPrice: extra.suggestedPrice ?? '' },
    'test@x',
  );
  if (!r.ok) throw new Error(r.error);
  supplyIds.push(r.id!);
  return r.id!;
}

describe('manufacturers', () => {
  it('creates with a unique slug, rejects duplicate names, renames update brand in the catalog', async () => {
    const id = await manufacturer(`יצרן בדיקה ${run}`);
    const m = await prisma.manufacturer.findUniqueOrThrow({ where: { id } });
    expect(m.slug).toBe(`יצרן-בדיקה-${run}`);
    const dup = await saveManufacturer(prisma, null, { name: `יצרן בדיקה ${run}`, logoUrl: null, website: '', description: '', isActive: true }, 'test@x');
    expect(dup).toEqual({ ok: false, error: 'כבר קיים יצרן בשם הזה' });

    const s = await supply(`מזמרה ${run}`, id, { manufacturerCode: ' MZ  100 ', barcode: '7290000000017', suggestedPrice: '49.9' });
    const row = await prisma.masterSupply.findUniqueOrThrow({ where: { id: s } });
    expect(row).toMatchObject({ brand: `יצרן בדיקה ${run}`, manufacturerCode: 'MZ 100', barcode: '7290000000017' });
    expect(row.suggestedPrice?.toString()).toBe('49.9');

    const versionsBefore = await prisma.catalogRevision.count({ where: { supplyId: s } });
    const r = await saveManufacturer(prisma, id, { name: `שם חדש ${run}`, logoUrl: null, website: 'example.com', description: '', isActive: true }, 'test@x');
    expect(r.ok).toBe(true);
    expect((await prisma.manufacturer.findUniqueOrThrow({ where: { id } })).slug).toBe(`יצרן-בדיקה-${run}`); // ה-slug לא משתנה
    expect((await prisma.masterSupply.findUniqueOrThrow({ where: { id: s } })).brand).toBe(`שם חדש ${run}`);
    // שינוי המותג = גרסת קטלוג חדשה (המשתלות יקבלו הצעת עדכון)
    expect(await prisma.catalogRevision.count({ where: { supplyId: s } })).toBe(versionsBefore + 1);

    // יצרן עם מוצרים לא נמחק; מוצר שלא נמשך — נמחק
    expect((await deleteManufacturer(prisma, id)).ok).toBe(false);
  });

  it('rejects an invalid barcode and a duplicate barcode in the catalog', async () => {
    const bad = await saveSupply(prisma, null, { title: 'x', manufacturerId: null, manufacturerCode: '', barcode: '12', category: 'TOOLS', description: '', imageUrl: null, suggestedPrice: '' }, 'test@x');
    expect(bad.ok).toBe(false);
    await supply(`עם ברקוד ${run}`, null, { barcode: `99${run}`.replace(/[a-z]/g, '1') });
    const dup = await saveSupply(prisma, null, { title: 'y', manufacturerId: null, manufacturerCode: '', barcode: `99${run}`.replace(/[a-z]/g, '1'), category: 'TOOLS', description: '', imageUrl: null, suggestedPrice: '' }, 'test@x');
    expect(dup).toEqual({ ok: false, error: 'הברקוד כבר קיים במוצר אחר בקטלוג' });
  });
});

describe('pullSupplies', () => {
  it('copies manufacturer, code, barcode and suggested price; skips owned; isolates nurseries', async () => {
    const m = await manufacturer(`גרדנה ${run}`);
    const priced = await supply(`צינור ${run}`, m, { manufacturerCode: 'G-1', barcode: `7290${run}1`.replace(/[a-z]/g, '3'), suggestedPrice: '30' });
    const noPrice = await supply(`זרנוק ${run}`, m);

    const r = await pullSupplies(prisma, f.A.nurseryId, [priced, noPrice, priced]);
    expect(r.created).toHaveLength(2);
    const p1 = await prisma.nurseryProduct.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId, supplyId: priced }, include: { variants: true } });
    expect(p1).toMatchObject({ manufacturerId: m, manufacturerCode: 'G-1', isActive: true, imageRequired: true });
    expect(p1.price.toString()).toBe('30');
    expect(p1.variants).toHaveLength(1);
    expect(p1.variants[0]!.barcode).toBe(`7290${run}1`.replace(/[a-z]/g, '3'));
    const p2 = await prisma.nurseryProduct.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId, supplyId: noPrice } });
    expect(p2.isActive).toBe(false); // בלי מחיר מומלץ — מוסתר עד שנקבע מחיר

    // שוב: הכול מדולג
    const again = await pullSupplies(prisma, f.A.nurseryId, [priced, noPrice]);
    expect(again).toMatchObject({ created: [], skipped: 2 });
    // משתלה B לא מושפעת ומושכת בנפרד
    expect(await prisma.nurseryProduct.count({ where: { nurseryId: f.B.nurseryId, supplyId: { in: [priced, noPrice] } } })).toBe(0);
    const b = await pullSupplies(prisma, f.B.nurseryId, [priced]);
    expect(b.created).toHaveLength(1);

    // מוצר שנמשך — לא נמחק מהקטלוג
    expect((await deleteSupply(prisma, priced)).ok).toBe(false);
  });

  it('creates the product without the barcode when it is taken in the nursery', async () => {
    const code = `5555${run}`.replace(/[a-z]/g, '7');
    const own = await prisma.nurseryProduct.create({ data: { nurseryId: f.A.nurseryId, customTitle: `שלי ${run}`, price: '5.00' } });
    await prisma.productVariant.updateMany({ where: { nurseryProductId: own.id, isDefault: true }, data: { barcode: code } });
    const s = await supply(`התנגשות ${run}`, null, { barcode: code, suggestedPrice: '10' });
    const r = await pullSupplies(prisma, f.A.nurseryId, [s]);
    expect(r).toMatchObject({ barcodeConflicts: 1 });
    expect(r.created).toHaveLength(1);
    const v = await prisma.productVariant.findFirstOrThrow({ where: { nurseryProductId: r.created[0]!.id, isDefault: true } });
    expect(v.barcode).toBeNull();
  });
});

describe('nursery product fields', () => {
  it('accepts only active manufacturers (or the current one) and stores sku/barcode on the default variant', async () => {
    const active = await manufacturer(`פעיל ${run}`);
    const off = await manufacturer(`מושבת ${run}`, false);
    expect(await parseProductManufacturer(prisma, { manufacturerId: active, manufacturerCode: ' X1 ' })).toEqual({ ok: true, data: { manufacturerId: active, manufacturerCode: 'X1' } });
    expect((await parseProductManufacturer(prisma, { manufacturerId: off, manufacturerCode: '' })).ok).toBe(false);
    expect((await parseProductManufacturer(prisma, { manufacturerId: off, manufacturerCode: '' }, off)).ok).toBe(true);

    const p = await prisma.nurseryProduct.create({ data: { nurseryId: f.B.nurseryId, customTitle: `מוצר ${run}`, price: '1.00' } });
    expect(await setDefaultVariantCodes(prisma, p.id, ' SKU-1 ', '7290000000999')).toEqual({ ok: true });
    const v = await prisma.productVariant.findFirstOrThrow({ where: { nurseryProductId: p.id, isDefault: true } });
    expect(v).toMatchObject({ sku: 'SKU-1', barcode: '7290000000999' });
    expect((await setDefaultVariantCodes(prisma, p.id, '', 'bad barcode!')).ok).toBe(false);
  });
});
