'use server';

import type { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { getSalesMode } from '@/lib/sales';
import { resolveProductContent, tenantUrl } from '@/lib/seo';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { getEnabledPaymentMethods } from '@/lib/payment-access';
import type { EnabledPaymentMethod } from '@/lib/payment-methods';
import { resolveShippingZone, hasAnyShippingZone } from '@/lib/shipping';
import {
  buildLineItems,
  calcSubtotal,
  assertCouponValid,
  applyDiscount,
  resolveShippingCost,
} from '@/lib/checkout-calc';
import {
  sendEmail,
  orderConfirmationEmail,
  newOrderNotificationEmail,
} from '@/lib/email';

export interface CheckoutInput {
  tenant: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress?: string;
  city?: string;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  items: Array<{ productId: string; quantity: number }>;
}

/** אמצעי התשלום הידניים הפעילים אצל המשתלה, לבניית טופס ה-checkout בצד הלקוח. */
export async function getCheckoutPaymentMethods(tenant: string): Promise<EnabledPaymentMethod[]> {
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) return [];
  return getEnabledPaymentMethods(nursery.id);
}

/** רשימת הערים הזמינות למשלוח אצל המשתלה (ריקה = לא מוגדרים אזורי משלוח). */
export async function getCheckoutShippingCities(tenant: string): Promise<string[]> {
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) return [];
  const zones = await prisma.shippingZone.findMany({
    where: { nurseryId: nursery.id, isEnabled: true },
    include: { cities: true },
    orderBy: { sortOrder: 'asc' },
  });
  return zones.flatMap((z) => z.cities.map((c) => c.cityName));
}

export interface CheckoutResult {
  ok?: boolean;
  orderId?: string;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const name = input.customerName?.trim();
  const email = input.customerEmail?.trim().toLowerCase();
  const phone = input.customerPhone?.trim();

  if (!name || !phone) return { error: 'יש למלא שם וטלפון' };
  if (!email || !EMAIL_RE.test(email)) return { error: 'כתובת אימייל לא תקינה' };

  const cart = (input.items ?? []).filter(
    (i) => i.productId && Number.isInteger(i.quantity) && i.quantity > 0,
  );
  if (cart.length === 0) return { error: 'העגלה ריקה' };

  // הגבלת קצב לפי כתובת IP כדי לבלום הצפת הזמנות
  if (!rateLimit(`checkout:ip:${clientIp()}`, 6, 10 * 60_000).ok) {
    return { error: 'יותר מדי הזמנות בזמן קצר. נסו שוב מאוחר יותר.' };
  }

  const nursery = await getNurseryByTenant(input.tenant);
  if (!nursery) return { error: 'המשתלה לא נמצאה' };

  const salesMode = await getSalesMode(nursery.id);
  if (salesMode === 'DISABLED') {
    return { error: 'המשתלה אינה מקבלת הזמנות אונליין כרגע' };
  }
  const isQuote = salesMode === 'QUOTE';

  // אימות אמצעי תשלום מול האפשרויות הפעילות אצל המשתלה (לא סומכים על הקלט מהלקוח)
  let paymentMethod: PaymentMethod | null = null;
  if (!isQuote && input.paymentMethod) {
    const allowed = await prisma.nurseryPaymentMethod.findFirst({
      where: { nurseryId: nursery.id, method: input.paymentMethod, isEnabled: true },
    });
    if (allowed) paymentMethod = input.paymentMethod;
  }
  const paymentReference = !isQuote ? input.paymentReference?.trim() || null : null;

  // אזור משלוח: רק אם למשתלה מוגדר לפחות אזור אחד (לא פוגע במשתלות שלא הגדירו משלוחים)
  let shippingZone: Awaited<ReturnType<typeof resolveShippingZone>> = null;
  if (!isQuote && (await hasAnyShippingZone(nursery.id))) {
    const city = input.city?.trim();
    if (!city) return { error: 'יש לבחור עיר למשלוח' };
    shippingZone = await resolveShippingZone(nursery.id, city);
    if (!shippingZone) return { error: 'משלוח לא זמין לעיר זו, צרו קשר עם המשתלה' };
  }

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      const products = await tx.nurseryProduct.findMany({
        where: { id: { in: cart.map((c) => c.productId) }, nurseryId: nursery.id, isActive: true },
        include: { plant: true, supply: true },
      });
      const byId = new Map(
        products.map((p) => {
          const { title } = resolveProductContent(p);
          return [p.id, { id: p.id, title, price: Number(p.price), stockQuantity: p.stockQuantity }];
        }),
      );

      const lineItems = buildLineItems(cart, byId, { isQuote });
      let total = calcSubtotal(lineItems);

      if (!isQuote && input.couponCode?.trim()) {
        const coupon = await tx.coupon.findFirst({
          where: { nurseryId: nursery.id, code: input.couponCode.trim(), isActive: true },
        });
        if (!coupon) throw new Error('קוד קופון לא תקף');
        assertCouponValid(coupon);

        // מיצוי מכסת שימושים (אם הוגדרה) — עדכון תנאי כדי למנוע חריגה במרוץ תנאים
        if (coupon.usageLimit !== null) {
          const res = await tx.coupon.updateMany({
            where: { id: coupon.id, usageCount: { lt: coupon.usageLimit } },
            data: { usageCount: { increment: 1 } },
          });
          if (res.count !== 1) throw new Error('קוד קופון מוצה');
        } else {
          await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
        }

        total = applyDiscount(total, Number(coupon.discountPct));
      }

      let shippingCost = 0;
      if (shippingZone) {
        shippingCost = resolveShippingCost(total, shippingZone);
        total += shippingCost;
      }

      // ניכוי מלאי (רק בהזמנה אונליין) — עם הגנה מפני מרוץ תנאים
      if (!isQuote) {
        for (const li of lineItems) {
          const res = await tx.nurseryProduct.updateMany({
            where: { id: li.nurseryProductId, stockQuantity: { gte: li.quantity } },
            data: { stockQuantity: { decrement: li.quantity } },
          });
          if (res.count !== 1) throw new Error('המלאי השתנה בזמן ההזמנה, נסו שוב');
        }
      }

      const order = await tx.order.create({
        data: {
          nurseryId: nursery.id,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: input.shippingAddress?.trim() || null,
          totalAmount: total.toFixed(2),
          status: isQuote ? 'QUOTE_REQUESTED' : 'PENDING',
          paymentMethod,
          paymentReference,
          shippingZoneId: shippingZone?.id ?? null,
          shippingCost: shippingZone ? shippingCost.toFixed(2) : null,
          items: { create: lineItems },
        },
      });
      return order.id;
    });

    // מיילים טרנזקציוניים — לא חוסמים ולא מפילים את ההזמנה אם נכשלים
    await sendOrderEmails(orderId, nursery, isQuote);

    return { ok: true, orderId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'אירעה שגיאה ביצירת ההזמנה' };
  }
}

async function sendOrderEmails(
  orderId: string,
  nursery: Awaited<ReturnType<typeof getNurseryByTenant>>,
  isQuote: boolean,
): Promise<void> {
  if (!nursery) return;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return;

    const data = {
      id: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      totalAmount: order.totalAmount.toString(),
      items: order.items.map((i) => ({
        productTitle: i.productTitle,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toString(),
      })),
      nurseryName: nursery.name,
      nurseryPhone: nursery.phoneNumber,
      storeUrl: tenantUrl(nursery, '/'),
    };

    const customer = orderConfirmationEmail(data, isQuote);
    const owner = newOrderNotificationEmail(data, isQuote);

    await Promise.allSettled([
      sendEmail({
        to: order.customerEmail,
        subject: customer.subject,
        html: customer.html,
        replyTo: nursery.ownerEmail,
      }),
      sendEmail({
        to: nursery.ownerEmail,
        subject: owner.subject,
        html: owner.html,
        replyTo: order.customerEmail,
      }),
    ]);
  } catch (e) {
    console.error('[checkout] שליחת מיילים נכשלה', e);
  }
}
