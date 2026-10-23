/**
 * פרטיות לקוח (R06-09): יצוא המידע ומחיקה מבוקרת. מקבל את ה-DB כפרמטר (בר-בדיקה).
 *
 * מחיקה (החלטת בעלים 2026-10-23): ההזמנות נשמרות לצורכי הנהלת חשבונות, **בלי פרטים אישיים**
 * (שם, מייל, טלפון, כתובת, אסמכתת תשלום); החשבון, הכתובות, המועדפים, ההערות, יומן הנקודות,
 * קודי הכניסה ומיילים בתור — נמחקים. רשומות יומן של הלקוח עצמו מאבדות את המייל.
 * לא מוחקים לקוח עם הזמנות פתוחות — המשתלה צריכה את הפרטים כדי לספק אותן.
 */
import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';

const OPEN = ['QUOTE_REQUESTED', 'RECEIVED', 'PENDING', 'PAID', 'PROCESSING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED'] as const;

/** מזהה קבוע ולא הפיך לרישום ב-Audit (בלי לשמור את המייל עצמו). */
export function emailRef(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

function ordersOf(nurseryId: string, email: string, customerId: string | null) {
  return {
    nurseryId,
    OR: [{ customerEmail: { equals: email, mode: 'insensitive' as const } }, ...(customerId ? [{ customerId }] : [])],
  };
}

/** כל המידע על הלקוח במשתלה הזו — לקובץ שהלקוח מוריד. */
export async function exportCustomerData(db: PrismaClient, nurseryId: string, email: string) {
  const e = email.toLowerCase();
  const customer = await db.customer.findUnique({
    where: { nurseryId_email: { nurseryId, email: e } },
    include: {
      addresses: true,
      favorites: { include: { product: { select: { customTitle: true, plant: { select: { hebrewName: true } }, supply: { select: { title: true } } } } } },
      loyaltyEntries: { orderBy: { createdAt: 'asc' } },
      group: { select: { name: true, discountPct: true } },
    },
  });
  const orders = await db.order.findMany({ where: ordersOf(nurseryId, e, customer?.id ?? null), include: { items: true }, orderBy: { createdAt: 'asc' } });
  return {
    exportedAt: new Date().toISOString(),
    profile: customer
      ? {
          email: customer.email,
          fullName: customer.fullName,
          phone: customer.phone,
          type: customer.type,
          companyName: customer.companyName,
          taxId: customer.taxId,
          group: customer.group ? { name: customer.group.name, discountPct: Number(customer.group.discountPct) } : null,
          marketingConsentAt: customer.marketingConsentAt,
          createdAt: customer.createdAt,
          lastLoginAt: customer.lastLoginAt,
        }
      : { email: e },
    addresses: customer?.addresses.map((a) => ({ label: a.label, city: a.city, street: a.street, postcode: a.postcode, isDefault: a.isDefault })) ?? [],
    favorites: customer?.favorites.map((f) => f.product.customTitle || f.product.plant?.hebrewName || f.product.supply?.title || '') ?? [],
    loyalty: customer?.loyaltyEntries.map((l) => ({ kind: l.kind, points: l.points, note: l.note, at: l.createdAt })) ?? [],
    orders: orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      deliveryMethod: o.deliveryMethod,
      totalAmount: Number(o.totalAmount),
      items: o.items.map((i) => ({ title: i.productTitle, variant: i.variantName, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    })),
  };
}

export type DeleteResult = { ok: true; anonymizedOrders: number; ref: string } | { ok: false; error: string };

export async function deleteCustomerData(db: PrismaClient, nurseryId: string, email: string): Promise<DeleteResult> {
  const e = email.toLowerCase().trim();
  if (!e) return { ok: false, error: 'חסר אימייל' };
  const customer = await db.customer.findUnique({ where: { nurseryId_email: { nurseryId, email: e } }, select: { id: true } });
  const where = ordersOf(nurseryId, e, customer?.id ?? null);
  const total = await db.order.count({ where });
  if (!customer && total === 0) return { ok: false, error: 'לא נמצא לקוח עם האימייל הזה' };
  const open = await db.order.count({ where: { ...where, status: { in: [...OPEN] } } });
  if (open > 0) return { ok: false, error: `יש ${open} הזמנות פתוחות — אפשר למחוק אחרי שיושלמו או יבוטלו` };

  const ref = emailRef(e);
  return db.$transaction(async (tx) => {
    const anonymized = await tx.order.updateMany({
      where,
      data: {
        customerName: 'לקוח שנמחק',
        customerEmail: `deleted-${ref}@deleted.invalid`,
        customerPhone: '',
        shippingAddress: null,
        shippingPostcode: null,
        paymentReference: null,
        customerId: null,
      },
    });
    // החשבון וכל מה שתלוי בו (כתובות, מועדפים, הערות, יומן נקודות) — נמחקים בשרשור
    if (customer) await tx.customer.delete({ where: { id: customer.id } });
    await tx.customerOtp.deleteMany({ where: { nurseryId, email: e } });
    await tx.emailJob.deleteMany({ where: { nurseryId, to: { has: e } } });
    await tx.auditEvent.updateMany({ where: { nurseryId, actorEmail: e }, data: { actorEmail: `deleted-${ref}` } });
    return { ok: true as const, anonymizedOrders: anonymized.count, ref };
  });
}
