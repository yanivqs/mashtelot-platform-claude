import { Prisma, type PrismaClient } from '@prisma/client';
import {
  asObject,
  diffRevisions,
  planSync,
  restoreField,
  syncFields,
  type CatalogKind,
  type FieldDiff,
} from '@/lib/catalog-sync';

/**
 * הצעות סנכרון לבעל משתלה (§6.03). מקבל את ה-DB כפרמטר (בר-בדיקה); כל פעולה מוגבלת
 * ל-nurseryId מה-session. מחיר/מלאי/וריאנטים/SKU/קטגוריות אינם חלק מהגרסה ולכן לא נוגעים בהם.
 */

export interface PendingUpdate {
  productId: string;
  title: string;
  kind: CatalogKind;
  fromVersion: number;
  toVersion: number;
  toRevisionId: string;
  diffs: FieldDiff[];
}

/** מוצרים שהגרסה הנעוצה שלהם ישנה מהאחרונה, ושיש להם שינויים בשדות שאינם מקומיים. */
export async function pendingUpdates(db: PrismaClient, nurseryId: string): Promise<PendingUpdate[]> {
  const rows = await db.$queryRaw<
    Array<{ product_id: string; custom_title: string | null; overrides: unknown; kind: CatalogKind; from_version: number; from_data: unknown; to_id: string; to_version: number; to_data: unknown }>
  >`
    SELECT np."id" AS product_id, np."custom_title", np."catalog_overrides" AS overrides,
           CASE WHEN pin."plant_id" IS NOT NULL THEN 'plant' ELSE 'supply' END AS kind,
           pin."version" AS from_version, pin."data" AS from_data,
           latest."id" AS to_id, latest."version" AS to_version, latest."data" AS to_data
    FROM "nursery_products" np
    JOIN "catalog_revisions" pin ON pin."id" = np."catalog_revision_id"
    JOIN LATERAL (
      SELECT r."id", r."version", r."data" FROM "catalog_revisions" r
      WHERE (pin."plant_id" IS NOT NULL AND r."plant_id" = pin."plant_id")
         OR (pin."supply_id" IS NOT NULL AND r."supply_id" = pin."supply_id")
      ORDER BY r."version" DESC LIMIT 1
    ) latest ON latest."version" > pin."version"
    WHERE np."nursery_id" = ${nurseryId}
    ORDER BY np."created_at" DESC`;

  const out: PendingUpdate[] = [];
  for (const r of rows) {
    const diffs = diffRevisions(r.kind, r.from_data, r.to_data, r.overrides);
    if (diffs.length === 0) continue; // כל השינויים בשדות מקומיים — אין מה להציע
    const from = asObject(r.from_data);
    const name = r.kind === 'plant' ? from.hebrewName : from.title;
    out.push({
      productId: r.product_id,
      title: r.custom_title || String(name ?? 'מוצר'),
      kind: r.kind,
      fromVersion: r.from_version,
      toVersion: r.to_version,
      toRevisionId: r.to_id,
      diffs,
    });
  }
  return out;
}

export async function pendingUpdateCount(db: PrismaClient, nurseryId: string): Promise<number> {
  return (await pendingUpdates(db, nurseryId)).length;
}

export type ApplySyncResult = { ok: true; accepted: string[]; rejected: string[] } | { ok: false; error: string };

/**
 * החלת החלטה על הצעה: מעבר לגרסה `toRevisionId` (חייבת להיות האחרונה של אותו פריט);
 * שדות שב-`rejectFields` נשמרים מקומית עם הערך שהוצג עד כה. מתועד ב-catalog_sync_decisions.
 */
export async function applySync(
  db: PrismaClient,
  args: { nurseryId: string; productId: string; toRevisionId: string; rejectFields: string[]; actorEmail?: string | null },
): Promise<ApplySyncResult> {
  return db.$transaction(async (tx) => {
    const p = await tx.nurseryProduct.findFirst({
      where: { id: args.productId, nurseryId: args.nurseryId },
      select: { id: true, catalogRevisionId: true, catalogOverrides: true, catalogRevision: true },
    });
    if (!p || !p.catalogRevision) return { ok: false as const, error: 'המוצר לא נמצא' };
    const pin = p.catalogRevision;
    const kind: CatalogKind = pin.plantId ? 'plant' : 'supply';

    const latest = await tx.catalogRevision.findFirst({
      where: pin.plantId ? { plantId: pin.plantId } : { supplyId: pin.supplyId },
      orderBy: { version: 'desc' },
    });
    if (!latest || latest.id !== args.toRevisionId) {
      return { ok: false as const, error: 'יש גרסה חדשה יותר בקטלוג — רעננו את הדף' };
    }
    if (latest.version <= pin.version) return { ok: false as const, error: 'אין עדכון ממתין למוצר זה' };

    const known = new Set(Object.keys(syncFields(kind)));
    const plan = planSync(kind, pin.data, latest.data, p.catalogOverrides, args.rejectFields.filter((f) => known.has(f)));

    // מותנה בגרסה הנעוצה — שתי החלטות מקבילות לא יוחלו פעמיים
    const res = await tx.nurseryProduct.updateMany({
      where: { id: p.id, nurseryId: args.nurseryId, catalogRevisionId: pin.id },
      data: {
        catalogRevisionId: latest.id,
        catalogOverrides: Object.keys(plan.overrides).length ? (plan.overrides as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    if (res.count !== 1) return { ok: false as const, error: 'המוצר עודכן במקביל — רעננו את הדף' };

    await tx.catalogSyncDecision.create({
      data: {
        nurseryId: args.nurseryId,
        nurseryProductId: p.id,
        fromRevisionId: pin.id,
        toRevisionId: latest.id,
        accepted: plan.accepted,
        rejected: plan.rejected,
        actorEmail: args.actorEmail ?? null,
      },
    });
    return { ok: true as const, accepted: plan.accepted, rejected: plan.rejected };
  });
}

export interface LocalFieldsRow {
  productId: string;
  title: string;
  fields: Array<{ field: string; label: string; value: unknown }>;
}

/** מוצרים עם שדות שנשמרו מקומית (לא מוצעים לסנכרון) — להחזרה לסנכרון. */
export async function productsWithLocalFields(db: PrismaClient, nurseryId: string): Promise<LocalFieldsRow[]> {
  const rows = await db.nurseryProduct.findMany({
    where: { nurseryId, NOT: { catalogOverrides: { equals: Prisma.DbNull } } },
    select: { id: true, customTitle: true, catalogOverrides: true, catalogRevision: true },
    orderBy: { createdAt: 'desc' },
  });
  const out: LocalFieldsRow[] = [];
  for (const r of rows) {
    const ov = asObject(r.catalogOverrides);
    if (!r.catalogRevision || Object.keys(ov).length === 0) continue;
    const kind: CatalogKind = r.catalogRevision.plantId ? 'plant' : 'supply';
    const labels = syncFields(kind);
    const data = asObject(r.catalogRevision.data);
    out.push({
      productId: r.id,
      title: r.customTitle || String((kind === 'plant' ? data.hebrewName : data.title) ?? 'מוצר'),
      fields: Object.entries(ov)
        .filter(([f]) => f in labels)
        .map(([field, value]) => ({ field, label: labels[field]!, value })),
    });
  }
  return out;
}

/** החזרת שדה לסנכרון: הערך המקומי נמחק והמוצר מציג את ערך הגרסה המאושרת. */
export async function restoreSyncField(
  db: PrismaClient,
  args: { nurseryId: string; productId: string; field: string; actorEmail?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const p = await db.nurseryProduct.findFirst({
    where: { id: args.productId, nurseryId: args.nurseryId },
    select: { id: true, catalogOverrides: true, catalogRevisionId: true },
  });
  if (!p || !p.catalogRevisionId) return { ok: false, error: 'המוצר לא נמצא' };
  if (!(args.field in asObject(p.catalogOverrides))) return { ok: false, error: 'השדה אינו מקומי' };
  const next = restoreField(p.catalogOverrides, args.field);
  await db.nurseryProduct.update({
    where: { id: p.id },
    data: { catalogOverrides: Object.keys(next).length ? (next as Prisma.InputJsonValue) : Prisma.DbNull },
  });
  await db.catalogSyncDecision.create({
    data: {
      nurseryId: args.nurseryId,
      nurseryProductId: p.id,
      fromRevisionId: p.catalogRevisionId,
      toRevisionId: p.catalogRevisionId,
      accepted: [args.field],
      rejected: [],
      actorEmail: args.actorEmail ?? null,
    },
  });
  return { ok: true };
}

/** כמה מוצרים בחנויות נעוצים לגרסה ישנה של הפריט (להצגה לסופר-אדמין אחרי עריכה). */
export async function productsBehind(db: PrismaClient, ref: { plantId?: string; supplyId?: string }): Promise<number> {
  const latest = await db.catalogRevision.findFirst({
    where: ref.plantId ? { plantId: ref.plantId } : { supplyId: ref.supplyId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  if (!latest) return 0;
  return db.nurseryProduct.count({
    where: {
      ...(ref.plantId ? { plantId: ref.plantId } : { supplyId: ref.supplyId }),
      catalogRevision: { version: { lt: latest.version } },
    },
  });
}
