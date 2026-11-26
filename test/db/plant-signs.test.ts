/**
 * שלטי צמחים: הזמנה עם Snapshot נעול לכל שלט, מחיר לפי סך השלטים (מחושב בשרת), הגדרות שמורות במוצר,
 * בידוד בין משתלות, וחסימת הזמנה של מוצר השלטים דרך המחשבון הרגיל / הזמנה חוזרת.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTemplate, publishDraft, saveDraft } from '@/lib/print-templates-admin';
import { createJobOrder } from '@/lib/print-jobs';
import { orderSaved } from '@/lib/print-saved';
import { createPlantSignOrder, findSignTemplate, parseSignLines, quoteSigns } from '@/lib/plant-sign/order';
import { loadSignSources } from '@/lib/plant-sign/load';
import type { SignData } from '@/lib/plant-sign/types';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
let templateId = '';
const plantIds: string[] = [];
const productIds: string[] = [];
const run = Math.random().toString(36).slice(2, 8);

const FIELDS = [
  {
    key: 'material',
    label: 'חומר',
    type: 'select',
    required: true,
    options: [
      { value: 'paper', label: 'נייר מנוילן', priceDelta: 0 },
      { value: 'pvc', label: 'PVC', priceDelta: 1 },
    ],
  },
];
const PRICING = {
  basePrice: 2,
  tiers: [{ minQty: 50, unitPrice: 1.5 }],
  setupFee: 0,
  minQuantity: 1,
  quoteOnly: false,
  quantityOptions: [100],
  allowCustomQuantity: false,
};

async function plantProduct(nurseryId: string, name: string, extra: Record<string, string> = {}) {
  const plant = await prisma.plant.create({
    data: {
      hebrewName: name,
      latinName: 'Testus plantus',
      light: 'קרינת שמש ישירה או הצללה חלקית',
      water: 'בינונית',
      plantType: 'שיחים',
      ...extra,
    },
  });
  plantIds.push(plant.id);
  const p = await prisma.nurseryProduct.create({ data: { nurseryId, plantId: plant.id, price: '20.00' } });
  productIds.push(p.id);
  return p;
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  const t = await createTemplate(
    prisma,
    {
      title: `שלטי צמחים ${run}`,
      description: null,
      category: null,
      imageUrl: null,
      unitLabel: 'שלט',
      leadTimeDays: 5,
      requiresArtwork: false,
      kind: 'PLANT_SIGN',
      isActive: false,
    },
    null,
  );
  templateId = t.id;
  await saveDraft(prisma, t.id, { fields: FIELDS, pricing: PRICING });
  await publishDraft(prisma, t.id, null);
  // לפני כל מוצר שלטים אחר (למשל מבדיקות E2E באותו בסיס)
  await prisma.printTemplate.update({ where: { id: t.id }, data: { isActive: true, sortOrder: -1000 } });
});

afterAll(async () => {
  const ids = { in: [f.A.nurseryId, f.B.nurseryId] };
  await prisma.printOrder.deleteMany({ where: { nurseryId: ids } });
  await prisma.printSavedProduct.deleteMany({ where: { nurseryId: ids } });
  await prisma.printTemplate.deleteMany({ where: { id: templateId } });
  await prisma.nurseryProduct.deleteMany({ where: { id: { in: productIds } } });
  await prisma.plant.deleteMany({ where: { id: { in: plantIds } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const actor = () => ({ nurseryId: f.A.nurseryId, userId: f.A.ownerId, actorEmail: f.A.ownerEmail });

describe('plant sign template', () => {
  it('found, with free quantity (the list of quantities does not apply to signs)', async () => {
    const t = await findSignTemplate(prisma);
    expect(t?.template.id).toBe(templateId);
    expect(t?.pricing.allowCustomQuantity).toBe(true);
    expect(t?.pricing.quantityOptions).toEqual([]);
  });

  it('price by the total number of signs', async () => {
    const a = await plantProduct(f.A.nurseryId, `לבנדר ${run}`);
    const b = await plantProduct(f.A.nurseryId, `רוזמרין ${run}`);
    const q = await quoteSigns(prisma, {
      lines: [
        { productId: a.id, quantity: 30 },
        { productId: b.id, quantity: 20 },
      ],
      values: { material: 'pvc' },
    });
    if (!q.ok) throw new Error(q.error);
    expect(q.total).toBe(50);
    // מדרגת 50+: 1.5 + PVC 1 = 2.5 לשלט
    expect(q.quote.total).toBe(125);
  });
});

describe('createPlantSignOrder', () => {
  it('order + approved job + a locked snapshot per sign, built from the saved sign settings', async () => {
    const a = await plantProduct(f.A.nurseryId, `מרווה ${run}`, { uniqueness: 'עלווה ריחנית' });
    const b = await plantProduct(f.A.nurseryId, `אזוביון ${run}`);
    await prisma.nurseryProduct.update({
      where: { id: a.id },
      data: { signSettings: { description: 'הטקסט שלי לשלט', notes: 'במבצע', water: { amount: 1 } } },
    });

    const r = await createPlantSignOrder(prisma, {
      ...actor(),
      lines: [
        { productId: a.id, quantity: 10 },
        { productId: b.id, quantity: 5 },
      ],
      values: { material: 'paper' },
      notes: 'דחוף',
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.quote.quantity).toBe(15);
    expect(r.quote.total).toBe(30);

    const order = await prisma.printOrder.findUniqueOrThrow({
      where: { id: r.orderId },
      include: { items: { include: { savedRevision: true } }, plantSigns: { orderBy: { sortOrder: 'asc' } } },
    });
    expect(order.status).toBe('NEW');
    expect(order.notes).toBe('דחוף');
    expect(order.items[0]!.quantity).toBe(15);
    expect(order.items[0]!.savedRevision?.status).toBe('APPROVED');
    expect(order.plantSigns.map((s) => s.quantity)).toEqual([10, 5]);

    const d = order.plantSigns[0]!.data as unknown as SignData;
    expect(d.hebrewName).toBe(`מרווה ${run}`);
    expect(d.description).toBe('הטקסט שלי לשלט');
    expect(d.notes).toBe('במבצע');
    expect(d.water.amount).toBe(1);
    expect(d.light.range).toEqual([0, 1]);
    expect(d.plantType).toBe('שיח');
    expect(d.qrUrl).toContain(f.A.subdomain);
    expect(d.qrUrl).toContain('/product/');

    // שינוי אחרי ההזמנה לא משנה את מה שיודפס
    await prisma.nurseryProduct.update({ where: { id: a.id }, data: { signSettings: { description: 'טקסט אחר' } } });
    const again = await prisma.printPlantSign.findFirstOrThrow({ where: { printOrderId: r.orderId, nurseryProductId: a.id } });
    expect((again.data as unknown as SignData).description).toBe('הטקסט שלי לשלט');
  });

  it('a plant product of another nursery is refused', async () => {
    const mine = await plantProduct(f.A.nurseryId, `שלי ${run}`);
    const theirs = await plantProduct(f.B.nurseryId, `שלהם ${run}`);
    const r = await createPlantSignOrder(prisma, {
      ...actor(),
      lines: [
        { productId: mine.id, quantity: 1 },
        { productId: theirs.id, quantity: 1 },
      ],
      values: { material: 'paper' },
    });
    expect(r.ok).toBe(false);
    expect(await loadSignSources(prisma, f.A.nurseryId, [theirs.id])).toEqual([]);
  });

  it('a product that is not a plant is refused', async () => {
    const r = await createPlantSignOrder(prisma, {
      ...actor(),
      lines: [{ productId: f.A.productId, quantity: 1 }],
      values: { material: 'paper' },
    });
    expect(r.ok).toBe(false);
  });

  it('template fields are validated on the server', async () => {
    const p = await plantProduct(f.A.nurseryId, `נענע ${run}`);
    const r = await createPlantSignOrder(prisma, { ...actor(), lines: [{ productId: p.id, quantity: 1 }], values: { material: 'gold' } });
    expect(r.ok).toBe(false);
  });
});

describe('the sign template is not ordered through the regular flows', () => {
  it('calculator order (createJobOrder) is refused', async () => {
    const v = await prisma.printTemplateVersion.findFirstOrThrow({ where: { templateId, status: 'PUBLISHED' } });
    const r = await createJobOrder(prisma, { ...actor(), templateVersionId: v.id, values: { material: 'paper' }, quantity: 10 });
    expect(r.ok).toBe(false);
  });

  it('quick reorder of a sign job is refused (reorder goes through the signs page)', async () => {
    const p = await plantProduct(f.A.nurseryId, `טימין ${run}`);
    const r = await createPlantSignOrder(prisma, { ...actor(), lines: [{ productId: p.id, quantity: 2 }], values: { material: 'paper' } });
    if (!r.ok) throw new Error(r.error);
    const job = await prisma.printSavedProduct.findFirstOrThrow({
      where: { revisions: { some: { orderItems: { some: { printOrderId: r.orderId } } } } },
    });
    const again = await orderSaved(prisma, { nurseryId: f.A.nurseryId, userId: null, savedProductId: job.id, quantity: 2 });
    expect(again.ok).toBe(false);
  });
});

describe('parseSignLines', () => {
  it('rejects duplicates, bad quantities and empty lists', () => {
    expect(parseSignLines([{ productId: 'a', quantity: 2 }])).toEqual([{ productId: 'a', quantity: 2 }]);
    expect(parseSignLines([])).toBeNull();
    expect(
      parseSignLines([
        { productId: 'a', quantity: 1 },
        { productId: 'a', quantity: 1 },
      ]),
    ).toBeNull();
    expect(parseSignLines([{ productId: 'a', quantity: 0 }])).toBeNull();
    expect(parseSignLines([{ productId: 'a', quantity: 1.5 }])).toBeNull();
    expect(parseSignLines([{ productId: 'a', quantity: 1001 }])).toBeNull();
    expect(parseSignLines('x')).toBeNull();
  });
});
