import { Prisma, type PrismaClient } from '@prisma/client';
import { isSafeImageUrl } from '@/lib/page-blocks';
import { isSupplyCategory, manufacturerSlug, normalizeBarcode, normalizeManufacturerCode } from '@/lib/manufacturers';

/**
 * ספקים ויצרנים וקטלוג הציוד המרכזי (החלטת בעלים 2026-11-23). מקבל את ה-DB כפרמטר (בר-בדיקה).
 * master_supplies.brand נשאר עם שם היצרן: הוא חלק מגרסת הקטלוג (supply_content_json), כך ששינוי יצרן
 * מגיע למשתלות כ"עדכון מהקטלוג".
 */

export type AdminResult = { ok: true; id?: string } | { ok: false; error: string };

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const notFound = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';

function safeWebsite(raw: string): string | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

// ---------- יצרנים ----------

export interface ManufacturerInput {
  name: string;
  logoUrl: string | null;
  website: string;
  description: string;
  isActive: boolean;
}

/** יצירה או עדכון. ה-slug נקבע ביצירה ולא משתנה (כתובות סינון בחנות נשארות). שינוי שם מעדכן את brand במוצרים. */
export async function saveManufacturer(db: PrismaClient, id: string | null, input: ManufacturerInput, actor: string): Promise<AdminResult> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) return { ok: false, error: 'יש לתת שם ליצרן (עד 80 תווים)' };
  if (input.logoUrl && !isSafeImageUrl(input.logoUrl)) return { ok: false, error: 'כתובת לוגו לא תקינה' };
  const website = safeWebsite(input.website);
  if (website === undefined) return { ok: false, error: 'כתובת האתר לא תקינה' };
  const description = input.description.trim().slice(0, 2000) || null;
  const data = { name, logoUrl: input.logoUrl, website, description, isActive: input.isActive };
  try {
    if (id) {
      const before = await db.manufacturer.findUnique({ where: { id }, select: { name: true } });
      if (!before) return { ok: false, error: 'היצרן לא נמצא' };
      await db.$transaction(async (tx) => {
        await tx.manufacturer.update({ where: { id }, data });
        if (before.name !== name) {
          await tx.$executeRaw`SELECT set_config('app.catalog_source', 'admin', true), set_config('app.catalog_actor', ${actor}, true)`;
          await tx.masterSupply.updateMany({ where: { manufacturerId: id }, data: { brand: name } });
        }
      });
      return { ok: true, id };
    }
    const base = manufacturerSlug(name) ?? 'm';
    let slug = base;
    for (let i = 2; await db.manufacturer.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
    const row = await db.manufacturer.create({ data: { ...data, slug } });
    return { ok: true, id: row.id };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'כבר קיים יצרן בשם הזה' };
    if (notFound(e)) return { ok: false, error: 'היצרן לא נמצא' };
    throw e;
  }
}

/** מחיקה רק של יצרן שאין לו מוצרים (בקטלוג ובמשתלות). אחרת — משביתים. */
export async function deleteManufacturer(db: PrismaClient, id: string): Promise<AdminResult> {
  const m = await db.manufacturer.findUnique({ where: { id }, include: { _count: { select: { supplies: true, nurseryProducts: true } } } });
  if (!m) return { ok: false, error: 'היצרן לא נמצא' };
  if (m._count.supplies || m._count.nurseryProducts) return { ok: false, error: 'ליצרן יש מוצרים. אפשר להשבית אותו במקום למחוק' };
  await db.manufacturer.delete({ where: { id } });
  return { ok: true };
}

// ---------- קטלוג הציוד המרכזי ----------

export interface SupplyInput {
  title: string;
  manufacturerId: string | null;
  manufacturerCode: string;
  barcode: string;
  category: string;
  description: string;
  imageUrl: string | null;
  suggestedPrice: string;
}

export async function saveSupply(db: PrismaClient, id: string | null, input: SupplyInput, actor: string): Promise<AdminResult> {
  const title = input.title.trim();
  if (!title || title.length > 160) return { ok: false, error: 'יש לתת שם למוצר (עד 160 תווים)' };
  const manufacturerCode = normalizeManufacturerCode(input.manufacturerCode);
  if (manufacturerCode === undefined) return { ok: false, error: 'קוד היצרן ארוך מדי (עד 60 תווים)' };
  const barcode = normalizeBarcode(input.barcode);
  if (barcode === undefined) return { ok: false, error: 'ברקוד לא תקין — ספרות או אותיות באנגלית, 4–32 תווים' };
  if (!isSupplyCategory(input.category)) return { ok: false, error: 'קטגוריה לא תקינה' };
  if (input.imageUrl && !isSafeImageUrl(input.imageUrl)) return { ok: false, error: 'כתובת תמונה לא תקינה' };
  let suggestedPrice: string | null = null;
  if (input.suggestedPrice.trim()) {
    const n = Number(input.suggestedPrice);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { ok: false, error: 'מחיר מומלץ לא תקין' };
    suggestedPrice = n.toFixed(2);
  }
  let brand: string | null = null;
  if (input.manufacturerId) {
    const m = await db.manufacturer.findUnique({ where: { id: input.manufacturerId }, select: { name: true } });
    if (!m) return { ok: false, error: 'היצרן לא נמצא' };
    brand = m.name;
  }
  const data = {
    title,
    brand,
    manufacturerId: input.manufacturerId,
    manufacturerCode,
    barcode,
    category: input.category,
    description: input.description.trim() || null,
    imageUrl: input.imageUrl,
    suggestedPrice,
  };
  try {
    const row = await db.$transaction(async (tx) => {
      // מקור ומבצע לגרסה שה-trigger יוצר (master_supplies_record_revision)
      await tx.$executeRaw`SELECT set_config('app.catalog_source', 'admin', true), set_config('app.catalog_actor', ${actor}, true)`;
      return id ? tx.masterSupply.update({ where: { id }, data }) : tx.masterSupply.create({ data });
    });
    return { ok: true, id: row.id };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'הברקוד כבר קיים במוצר אחר בקטלוג' };
    if (notFound(e)) return { ok: false, error: 'המוצר לא נמצא' };
    throw e;
  }
}

/** מחיקה רק של מוצר שאף משתלה לא משכה. */
export async function deleteSupply(db: PrismaClient, id: string): Promise<AdminResult> {
  const s = await db.masterSupply.findUnique({ where: { id }, include: { _count: { select: { nurseryProducts: true } } } });
  if (!s) return { ok: false, error: 'המוצר לא נמצא' };
  if (s._count.nurseryProducts) return { ok: false, error: `${s._count.nurseryProducts} משתלות כבר משכו את המוצר, ולכן אי אפשר למחוק אותו` };
  await db.masterSupply.delete({ where: { id } });
  return { ok: true };
}

// ---------- משיכה למשתלה ----------

export interface PullResult {
  created: Array<{ id: string; supplyId: string }>;
  skipped: number;
  /** ברקוד שכבר קיים במוצר אחר של המשתלה — המוצר נוצר בלי ברקוד */
  barcodeConflicts: number;
}

/**
 * מוסיף למשתלה מוצרים מקטלוג הציוד: מחיר = המחיר המומלץ (בלי מחיר — נוצר מוסתר), יצרן וקוד יצרן מועתקים,
 * והברקוד נכתב בווריאנט ברירת המחדל (שה-trigger במסד יוצר). מוצר שכבר קיים במשתלה — מדולג.
 * כמו משיכה רגילה: מוסתר מהחנות עד שבעל המשתלה מעלה תמונה משלו (imageRequired).
 */
export async function pullSupplies(db: PrismaClient, nurseryId: string, supplyIds: string[]): Promise<PullResult> {
  const unique = [...new Set(supplyIds)].slice(0, 500);
  const supplies = await db.masterSupply.findMany({ where: { id: { in: unique } } });
  const owned = new Set(
    (await db.nurseryProduct.findMany({ where: { nurseryId, supplyId: { in: unique } }, select: { supplyId: true } })).map((p) => p.supplyId),
  );
  const result: PullResult = { created: [], skipped: unique.length - supplies.length, barcodeConflicts: 0 };
  for (const s of supplies) {
    if (owned.has(s.id)) {
      result.skipped++;
      continue;
    }
    const price = s.suggestedPrice && Number(s.suggestedPrice) > 0 ? s.suggestedPrice : new Prisma.Decimal('0.00');
    try {
      const product = await db.nurseryProduct.create({
        data: {
          nurseryId,
          supplyId: s.id,
          price,
          stockQuantity: 0,
          isActive: Number(price) > 0,
          imageRequired: true,
          manufacturerId: s.manufacturerId,
          manufacturerCode: s.manufacturerCode,
        },
      });
      result.created.push({ id: product.id, supplyId: s.id });
      if (s.barcode) {
        try {
          await db.productVariant.updateMany({ where: { nurseryProductId: product.id, isDefault: true }, data: { barcode: s.barcode } });
        } catch (e) {
          if (!isUnique(e)) throw e;
          result.barcodeConflicts++;
        }
      }
    } catch (e) {
      // נוסף במקביל (unique על nurseryId+supplyId)
      if (!isUnique(e)) throw e;
      result.skipped++;
    }
  }
  return result;
}

// ---------- מוצר של משתלה: יצרן, קוד יצרן, מק"ט וברקוד ----------

/** יצרן מהרשימה (פעיל, או היצרן הנוכחי של המוצר גם אם הושבת) + קוד יצרן. */
export async function parseProductManufacturer(
  db: PrismaClient,
  raw: { manufacturerId: string; manufacturerCode: string },
  currentId: string | null = null,
): Promise<{ ok: true; data: { manufacturerId: string | null; manufacturerCode: string | null } } | { ok: false; error: string }> {
  const manufacturerCode = normalizeManufacturerCode(raw.manufacturerCode);
  if (manufacturerCode === undefined) return { ok: false, error: 'קוד היצרן ארוך מדי (עד 60 תווים)' };
  const id = raw.manufacturerId.trim() || null;
  if (id && id !== currentId) {
    const m = await db.manufacturer.findUnique({ where: { id }, select: { isActive: true } });
    if (!m || !m.isActive) return { ok: false, error: 'הספק / היצרן לא נמצא ברשימה' };
  }
  return { ok: true, data: { manufacturerId: id, manufacturerCode } };
}

/** מק"ט וברקוד בווריאנט ברירת המחדל (מוצר עם וריאנט יחיד). ייחודיים במשתלה. */
export async function setDefaultVariantCodes(db: PrismaClient, productId: string, skuRaw: string, barcodeRaw: string): Promise<AdminResult> {
  const sku = skuRaw.trim().slice(0, 60) || null;
  const barcode = normalizeBarcode(barcodeRaw);
  if (barcode === undefined) return { ok: false, error: 'ברקוד לא תקין — ספרות או אותיות באנגלית, 4–32 תווים' };
  try {
    await db.productVariant.updateMany({ where: { nurseryProductId: productId, isDefault: true }, data: { sku, barcode } });
    return { ok: true };
  } catch (e) {
    if (isUnique(e)) return { ok: false, error: 'המק"ט או הברקוד כבר קיימים במוצר אחר שלכם' };
    throw e;
  }
}
