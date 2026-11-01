/**
 * האזור האישי של לקוח (R06-04, §13.02-03): הזמנות, כתובות, מועדפים, "הזמן שוב".
 * מקבל את ה-DB כפרמטר (בר-בדיקה). כל שאילתה מסוננת לפי הלקוח **וגם** המשתלה —
 * לקוח לעולם לא רואה הזמנה/כתובת/מוצר של לקוח או משתלה אחרים (§13 קבלה).
 */
import { STORE_VISIBLE } from '@/lib/product-visibility';
import type { PrismaClient } from '@prisma/client';
import { sellableQuantity } from '@/lib/stock';
import { activeVariants, effectivePrice, lineTitle } from '@/lib/variants';
import { normalizePostcode } from '@/lib/shipping-zones';

export const MAX_ADDRESSES = 10;

export type PortalResult = { ok: true } | { ok: false; error: string };

// ---------- הזמנות ----------

export function customerOrders(db: PrismaClient, nurseryId: string, customerId: string, take = 50) {
  return db.order.findMany({
    where: { nurseryId, customerId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, createdAt: true, status: true, paymentStatus: true, totalAmount: true, _count: { select: { items: true } } },
  });
}

/** הזמנה אחת — רק של הלקוח ובמשתלה הזו (אחרת null → 404). */
export function customerOrder(db: PrismaClient, nurseryId: string, customerId: string, orderId: string) {
  return db.order.findFirst({ where: { id: orderId, nurseryId, customerId }, include: { items: true } });
}

// ---------- כתובות ----------

export interface AddressInput {
  label?: string | null;
  city: string;
  street: string;
  postcode?: string | null;
  isDefault?: boolean;
}

function cleanAddress(a: AddressInput): { ok: true; value: AddressInput } | { ok: false; error: string } {
  const city = a.city.trim().slice(0, 80);
  const street = a.street.trim().slice(0, 160);
  if (!city || !street) return { ok: false, error: 'יש למלא עיר ורחוב' };
  const pc = normalizePostcode(a.postcode);
  if (pc === null) return { ok: false, error: 'מיקוד לא תקין — 7 ספרות' };
  return { ok: true, value: { label: a.label?.trim().slice(0, 40) || null, city, street, postcode: pc || null, isDefault: Boolean(a.isDefault) } };
}

export async function addAddress(db: PrismaClient, customerId: string, input: AddressInput): Promise<PortalResult> {
  const c = cleanAddress(input);
  if (!c.ok) return c;
  return db.$transaction(async (tx) => {
    const count = await tx.customerAddress.count({ where: { customerId } });
    if (count >= MAX_ADDRESSES) return { ok: false as const, error: `אפשר לשמור עד ${MAX_ADDRESSES} כתובות` };
    const isDefault = c.value.isDefault || count === 0; // הכתובת הראשונה — ברירת מחדל
    if (isDefault) await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
    await tx.customerAddress.create({
      data: { customerId, label: c.value.label, city: c.value.city, street: c.value.street, postcode: c.value.postcode, isDefault },
    });
    return { ok: true as const };
  });
}

export async function deleteAddress(db: PrismaClient, customerId: string, addressId: string): Promise<PortalResult> {
  const r = await db.customerAddress.deleteMany({ where: { id: addressId, customerId } });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'הכתובת לא נמצאה' };
}

export async function setDefaultAddress(db: PrismaClient, customerId: string, addressId: string): Promise<PortalResult> {
  return db.$transaction(async (tx) => {
    const a = await tx.customerAddress.findFirst({ where: { id: addressId, customerId } });
    if (!a) return { ok: false as const, error: 'הכתובת לא נמצאה' };
    await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
    await tx.customerAddress.update({ where: { id: a.id }, data: { isDefault: true } });
    return { ok: true as const };
  });
}

export function customerAddresses(db: PrismaClient, customerId: string) {
  return db.customerAddress.findMany({ where: { customerId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
}

// ---------- מועדפים ----------

/** הוספה/הסרה. רק מוצר פעיל של המשתלה של הלקוח. */
export async function toggleFavorite(db: PrismaClient, nurseryId: string, customerId: string, productId: string): Promise<{ ok: true; favorite: boolean } | { ok: false; error: string }> {
  const existing = await db.customerFavorite.findUnique({ where: { customerId_nurseryProductId: { customerId, nurseryProductId: productId } } });
  if (existing) {
    await db.customerFavorite.delete({ where: { id: existing.id } });
    return { ok: true, favorite: false };
  }
  const p = await db.nurseryProduct.findFirst({ where: { id: productId, nurseryId, ...STORE_VISIBLE }, select: { id: true } });
  if (!p) return { ok: false, error: 'המוצר לא נמצא' };
  await db.customerFavorite.upsert({
    where: { customerId_nurseryProductId: { customerId, nurseryProductId: p.id } },
    create: { customerId, nurseryProductId: p.id },
    update: {},
  });
  return { ok: true, favorite: true };
}

export async function isFavorite(db: PrismaClient, customerId: string, productId: string): Promise<boolean> {
  return (await db.customerFavorite.count({ where: { customerId, nurseryProductId: productId } })) > 0;
}

// ---------- "הזמן שוב" ----------

export interface ReorderLine {
  productId: string;
  variantId: string;
  title: string;
  price: number;
  quantity: number;
}

/**
 * פריטי הזמנה קודמת לעגלה, **במחיר ובמלאי של היום**: מוצר/וריאנט שאינו פעיל או שאזל — מדולג;
 * כמות מוגבלת למלאי הזמין. המחיר הסופי נקבע שוב בשרת בקופה.
 */
export async function reorderLines(
  db: PrismaClient,
  nurseryId: string,
  customerId: string,
  orderId: string,
): Promise<{ ok: true; lines: ReorderLine[]; skipped: string[] } | { ok: false; error: string }> {
  const order = await customerOrder(db, nurseryId, customerId, orderId);
  if (!order) return { ok: false, error: 'ההזמנה לא נמצאה' };
  const lines: ReorderLine[] = [];
  const skipped: string[] = [];
  for (const item of order.items) {
    const name = lineTitle(item.productTitle, item.variantName);
    const product = await db.nurseryProduct.findFirst({
      where: { id: item.nurseryProductId, nurseryId, ...STORE_VISIBLE },
      include: { variants: true },
    });
    const variants = product ? activeVariants(product.variants) : [];
    const v = variants.find((x) => x.id === item.variantId) ?? (item.variantId ? undefined : variants.find((x) => x.isDefault));
    const available = v && product ? sellableQuantity(v, product) : 0;
    if (!product || !v || available <= 0) {
      skipped.push(name);
      continue;
    }
    lines.push({
      productId: product.id,
      variantId: v.id,
      title: lineTitle(item.productTitle, variants.length > 1 ? v.name : null),
      price: effectivePrice(v, product),
      quantity: Math.min(item.quantity, available),
    });
  }
  return { ok: true, lines, skipped };
}
