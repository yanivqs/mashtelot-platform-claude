import { Prisma, type PrismaClient } from '@prisma/client';
import { asObject } from '@/lib/catalog-sync';
import { PLANT_SUGGEST_FIELDS, sameValue, type PlantField, type PlantFieldValues } from '@/lib/plant-fields';

/**
 * צמחים של בעל משתלה (מקבל את ה-DB כפרמטר — בר-בדיקה):
 * - צמח פרטי: שורה ב-plants עם owner_nursery_id — מוצג רק בחנות של המשתלה, ואפשר להציע אותו לקטלוג.
 * - צמח מהקטלוג: שינוי שדה בוטני נשמר מקומית ב-catalog_overrides (לא נוגעים בקטלוג הראשי).
 */

type Tx = Prisma.TransactionClient;

async function asNursery(tx: Tx, actor: string | null | undefined) {
  // מקור ומבצע לגרסה שה-trigger יוצר (plants_record_revision)
  await tx.$executeRaw`SELECT set_config('app.catalog_source', 'nursery', true), set_config('app.catalog_actor', ${actor ?? ''}, true)`;
}

function plantData(fields: PlantFieldValues): Prisma.PlantUpdateInput {
  return { ...fields } as Prisma.PlantUpdateInput;
}

export type ProductCreateData = Omit<Prisma.NurseryProductUncheckedCreateInput, 'nurseryId' | 'plantId' | 'supplyId'>;

/** יצירת צמח פרטי + מוצר מקושר אליו (ה-trigger נועץ את הגרסה הראשונה). */
export async function createNurseryPlantProduct(
  db: PrismaClient,
  args: {
    nurseryId: string;
    fields: PlantFieldValues;
    submit: boolean;
    description?: string | null;
    product: ProductCreateData;
    actor?: string | null;
  },
): Promise<{ ok: true; productId: string; plantId: string } | { ok: false; error: string }> {
  const hebrewName = args.fields.hebrewName?.trim();
  if (!hebrewName) return { ok: false, error: 'יש להזין שם לצמח' };
  return db.$transaction(async (tx) => {
    await asNursery(tx, args.actor);
    const plant = await tx.plant.create({
      data: {
        ...(args.fields as Record<PlantField, string | null>),
        hebrewName,
        description: args.description ?? null,
        ownerNurseryId: args.nurseryId,
        submittedAt: args.submit ? new Date() : null,
      },
      select: { id: true },
    });
    const product = await tx.nurseryProduct.create({
      data: { ...args.product, nurseryId: args.nurseryId, plantId: plant.id },
      select: { id: true },
    });
    return { ok: true as const, productId: product.id, plantId: plant.id };
  });
}

export type SavePlantResult = { ok: true; mode: 'private' | 'local' } | { ok: false; error: string };

/**
 * שמירת השדות הבוטניים של מוצר-צמח של המשתלה.
 * צמח פרטי שלה — מעדכן את הצמח ונועץ את המוצר לגרסה החדשה (אין "עדכון מהקטלוג" על שינוי של עצמה).
 * צמח מהקטלוג — כל שדה ששונה מהגרסה המאושרת נשמר מקומית; שדה שהוחזר לערך הקטלוג — מוסר.
 */
export async function savePlantDetails(
  db: PrismaClient,
  args: {
    nurseryId: string;
    productId: string;
    fields: PlantFieldValues;
    submit?: boolean;
    actor?: string | null;
  },
): Promise<SavePlantResult> {
  const p = await db.nurseryProduct.findFirst({
    where: { id: args.productId, nurseryId: args.nurseryId, deletedAt: null },
    select: {
      id: true,
      plantId: true,
      catalogOverrides: true,
      catalogRevision: { select: { data: true } },
      plant: { select: { ownerNurseryId: true, submittedAt: true } },
    },
  });
  if (!p || !p.plantId || !p.plant) return { ok: false, error: 'המוצר לא נמצא' };
  const plantId = p.plantId;

  if (p.plant.ownerNurseryId === args.nurseryId) {
    if ('hebrewName' in args.fields && !args.fields.hebrewName) return { ok: false, error: 'יש להזין שם לצמח' };
    const submittedAt = args.submit === undefined ? undefined : args.submit ? (p.plant.submittedAt ?? new Date()) : null;
    const moved = 'הצמח כבר נוסף לקטלוג הראשי — רעננו את הדף';
    try {
      await db.$transaction(async (tx) => {
        await asNursery(tx, args.actor);
        // מותנה בבעלות — אם הצמח קודם לקטלוג בינתיים, לא נכתב
        const res = await tx.plant.updateMany({
          where: { id: plantId, ownerNurseryId: args.nurseryId },
          data: {
            ...(plantData(args.fields) as Prisma.PlantUpdateManyMutationInput),
            ...(submittedAt !== undefined ? { submittedAt } : {}),
          },
        });
        if (res.count !== 1) throw new Error(moved);
        const latest = await tx.catalogRevision.findFirst({
          where: { plantId },
          orderBy: { version: 'desc' },
          select: { id: true },
        });
        await tx.nurseryProduct.update({
          where: { id: p.id },
          data: {
            catalogRevisionId: latest?.id ?? null,
            catalogOverrides: Prisma.DbNull,
          },
        });
      });
    } catch (e) {
      if (e instanceof Error && e.message === moved) return { ok: false, error: moved };
      throw e;
    }
    return { ok: true, mode: 'private' };
  }

  // צמח מהקטלוג: השוואה לגרסה הנעוצה (מוצר ישן בלי גרסה — נועצים לאחרונה)
  let revData = p.catalogRevision?.data;
  let pinId: string | undefined;
  if (!revData) {
    const latest = await db.catalogRevision.findFirst({
      where: { plantId },
      orderBy: { version: 'desc' },
      select: { id: true, data: true },
    });
    if (!latest) return { ok: false, error: 'לא נמצאה גרסת קטלוג לצמח' };
    revData = latest.data;
    pinId = latest.id;
  }
  const base = asObject(revData);
  const ov = { ...asObject(p.catalogOverrides) };
  for (const [field, value] of Object.entries(args.fields)) {
    if (sameValue(value, base[field])) delete ov[field];
    else ov[field] = value ?? null;
  }
  await db.nurseryProduct.update({
    where: { id: p.id },
    data: {
      catalogOverrides: Object.keys(ov).length ? (ov as Prisma.InputJsonValue) : Prisma.DbNull,
      ...(pinId ? { catalogRevisionId: pinId } : {}),
    },
  });
  return { ok: true, mode: 'local' };
}

/** הצעות לשדות שמזינים מסננים — הערכים הנפוצים בקטלוג הראשי. */
export async function plantFieldSuggestions(db: PrismaClient): Promise<Partial<Record<PlantField, string[]>>> {
  const columns: Record<string, string> = {
    plantType: 'plant_type',
    light: 'light',
    water: 'water',
    floweringSeason: 'flowering_season',
    flowerColor: 'flower_color',
    growthRate: 'growth_rate',
    evergreen: 'evergreen',
    coastal: 'coastal',
    native: 'native',
  };
  const out: Partial<Record<PlantField, string[]>> = {};
  await Promise.all(
    PLANT_SUGGEST_FIELDS.map(async (field) => {
      const col = columns[field];
      if (!col) return;
      // שם העמודה מרשימה קבועה (לא מקלט משתמש)
      const rows = await db.$queryRawUnsafe<Array<{ v: string }>>(
        `SELECT btrim("${col}") AS v FROM "plants" WHERE "owner_nursery_id" IS NULL AND btrim(coalesce("${col}", '')) <> ''
         GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT ${field === 'plantType' ? 40 : 15}`,
      );
      out[field] = rows.map((r) => r.v);
    }),
  );
  return out;
}

/** סופר-אדמין: הוספת צמח שהוצע לקטלוג הראשי (מעכשיו כל המשתלות יכולות למשוך אותו). */
export async function promotePlant(db: PrismaClient, plantId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await db.plant.updateMany({
    where: { id: plantId, ownerNurseryId: { not: null } },
    data: { ownerNurseryId: null, submittedAt: null },
  });
  return res.count === 1 ? { ok: true } : { ok: false, error: 'הצמח כבר בקטלוג הראשי' };
}

/** סופר-אדמין: דחיית הצעה — הצמח נשאר פרטי בחנות של המשתלה. */
export async function rejectPlantSuggestion(db: PrismaClient, plantId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await db.plant.updateMany({
    where: {
      id: plantId,
      ownerNurseryId: { not: null },
      submittedAt: { not: null },
    },
    data: { submittedAt: null },
  });
  return res.count === 1 ? { ok: true } : { ok: false, error: 'אין הצעה ממתינה לצמח הזה' };
}
