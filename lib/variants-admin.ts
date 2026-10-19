import { Prisma, type PrismaClient } from '@prisma/client';
import { setOnHandStock } from '@/lib/order-service';
import { validateVariantInput, type VariantInput } from '@/lib/variants';

/**
 * ניהול וריאנטים בידי בעל המשתלה (§7.01). מקבל את ה-DB כפרמטר (בר-בדיקה). כל פעולה
 * מוגבלת ל-nurseryId מה-session ולמוצר שלה — וריאנט של משתלה/מוצר אחר לא נמצא.
 * מלאי — רק דרך setOnHandStock (לא מתחת לשמור, נרשם כתנועה).
 */

export type SaveVariantResult = { ok: true; variantId: string } | { ok: false; error: string };

function uniqueError(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = String((e.meta as { target?: unknown } | undefined)?.target ?? '');
    if (target.includes('sku')) return 'ה-SKU כבר בשימוש במוצר אחר במשתלה';
    if (target.includes('barcode')) return 'הברקוד כבר בשימוש במוצר אחר במשתלה';
    return 'ערך כפול';
  }
  return null;
}

export async function saveVariant(
  db: PrismaClient,
  args: { nurseryId: string; productId: string; variantId: string | null; input: VariantInput; actorEmail?: string | null },
): Promise<SaveVariantResult> {
  const { nurseryId, productId, input } = args;
  const product = await db.nurseryProduct.findFirst({ where: { id: productId, nurseryId }, select: { id: true } });
  if (!product) return { ok: false, error: 'המוצר לא נמצא' };

  const existing = args.variantId
    ? await db.productVariant.findFirst({ where: { id: args.variantId, nurseryId, nurseryProductId: productId } })
    : null;
  if (args.variantId && !existing) return { ok: false, error: 'הווריאנט לא נמצא' };

  const siblings = await db.productVariant.count({
    where: { nurseryProductId: productId, isActive: true, ...(existing ? { id: { not: existing.id } } : {}) },
  });
  const err = validateVariantInput(input, { isDefault: existing?.isDefault ?? false, hasSiblings: siblings > 0 });
  if (err) return { ok: false, error: err };

  const data = {
    name: input.name.trim(),
    sku: input.sku?.trim() || null,
    barcode: input.barcode?.trim() || null,
    price: input.price === null ? null : input.price.toFixed(2),
    compareAtPrice: input.compareAtPrice === null ? null : input.compareAtPrice.toFixed(2),
    imageUrls: input.imageUrls,
    isActive: input.isActive,
  };

  let variantId: string;
  try {
    if (existing) {
      await db.productVariant.update({ where: { id: existing.id }, data });
      variantId = existing.id;
    } else {
      const last = await db.productVariant.findFirst({
        where: { nurseryProductId: productId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      const created = await db.productVariant.create({
        data: { ...data, nurseryId, nurseryProductId: productId, sortOrder: (last?.sortOrder ?? 0) + 1 },
      });
      variantId = created.id;
    }
  } catch (e) {
    const msg = uniqueError(e);
    if (msg) return { ok: false, error: msg };
    throw e;
  }

  const stock = await setOnHandStock(db, {
    nurseryId,
    productId,
    variantId,
    quantity: input.stockQuantity,
    actorEmail: args.actorEmail,
  });
  if (!stock.ok) return { ok: false, error: stock.error };
  return { ok: true, variantId };
}

export type DeleteVariantResult =
  | { ok: true; deleted: boolean; deactivated: boolean }
  | { ok: false; error: string };

/**
 * מחיקת וריאנט. ברירת המחדל לא נמחקת. וריאנט שהוזמן או שיש עליו מלאי שמור — מושבת במקום
 * מחיקה, כדי לשמור את היסטוריית ההזמנות והמלאי (§8.02).
 */
export async function deleteVariant(
  db: PrismaClient,
  args: { nurseryId: string; productId: string; variantId: string },
): Promise<DeleteVariantResult> {
  const v = await db.productVariant.findFirst({
    where: { id: args.variantId, nurseryId: args.nurseryId, nurseryProductId: args.productId },
    include: { _count: { select: { orderItems: true, stockMovements: true } } },
  });
  if (!v) return { ok: false, error: 'הווריאנט לא נמצא' };
  if (v.isDefault) return { ok: false, error: 'אי אפשר למחוק את וריאנט ברירת המחדל — אפשר לשנות לו שם, מחיר ומלאי' };

  if (v._count.orderItems > 0 || v._count.stockMovements > 0 || v.reservedQuantity > 0) {
    if (v.reservedQuantity > 0) return { ok: false, error: 'יש יחידות שמורות להזמנות פתוחות — לא ניתן להסיר כעת' };
    await db.productVariant.update({ where: { id: v.id }, data: { isActive: false } });
    return { ok: true, deleted: false, deactivated: true };
  }
  await db.productVariant.delete({ where: { id: v.id } });
  return { ok: true, deleted: true, deactivated: false };
}
