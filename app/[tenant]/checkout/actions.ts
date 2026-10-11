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
import { recordAudit } from '@/lib/audit';
import {
  buildLineItems,
  calcSubtotal,
  assertCouponValid,
  applyDiscount,
  resolveShippingCost,
  availableDeliveryMethods,
  resolveDeliveryMethod,
  type DeliveryChoice,
} from '@/lib/checkout-calc';
import {
  sendEmail,
  orderConfirmationEmail,
  newOrderNotificationEmail,
  orderNotificationRecipients,
} from '@/lib/email';

export interface CheckoutInput {
  tenant: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod?: DeliveryChoice;
  shippingAddress?: string;
  city?: string;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  items: Array<{ productId: string; quantity: number }>;
}

export interface CheckoutShippingZone {
  cities: string[];
  shippingPrice: number;
  freeShippingThreshold: number | null;
}

export interface CheckoutOptions {
  paymentMethods: EnabledPaymentMethod[];
  deliveryMethods: DeliveryChoice[];
  deliveryNote: string | null;
  pickupAddress: string | null;
  /** אזורי משלוח פעילים (ריק = עיר חופשית ועלות שתתואם מול המשתלה) */
  zones: CheckoutShippingZone[];
}

/** כל מה שטופס ה-checkout צריך: אמצעי תשלום, אופני קבלה ואזורי משלוח. */
export async function getCheckoutOptions(tenant: string): Promise<CheckoutOptions | null> {
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) return null;
  const [paymentMethods, zones] = await Promise.all([
    getEnabledPaymentMethods(nursery.id),
    prisma.shippingZone.findMany({
      where: { nurseryId: nursery.id, isEnabled: true },
      include: { cities: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  return {
    paymentMethods,
    deliveryMethods: availableDeliveryMethods(nursery),
    deliveryNote: nursery.deliveryNote,
    pickupAddress: [nursery.addressLine, nursery.city].filter(Boolean).join(', ') || null,
    zones: zones
      .filter((z) => z.cities.length > 0)
      .map((z) => ({
        cities: z.cities.map((c) => c.cityName),
        shippingPrice: Number(z.shippingPrice),
        freeShippingThreshold: z.freeShippingThreshold !== null ? Number(z.freeShippingThreshold) : null,
      })),
  };
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

  // אופן קבלה: איסוף עצמי / משלוח (לפי מה שהמשתלה מאפשרת)
  let deliveryMethod: DeliveryChoice;
  try {
    deliveryMethod = resolveDeliveryMethod(input.deliveryMethod, availableDeliveryMethods(nursery));
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'יש לבחור אופן קבלה' };
  }

  let shippingAddress: string | null = null;
  let shippingZone: Awaited<ReturnType<typeof resolveShippingZone>> = null;
  if (deliveryMethod === 'DELIVERY') {
    const street = input.shippingAddress?.trim();
    const city = input.city?.trim();
    if (!city) return { error: 'יש לבחור עיר למשלוח' };
    if (!street) return { error: 'יש למלא כתובת למשלוח' };
    shippingAddress = `${street}, ${city}`;

    // אזור משלוח: רק אם למשתלה מוגדר לפחות אזור אחד; אחרת העלות מתואמת מול המשתלה
    if (await hasAnyShippingZone(nursery.id)) {
      shippingZone = await resolveShippingZone(nursery.id, city);
      if (!shippingZone) return { error: 'משלוח לא זמין לעיר זו, צרו קשר עם המשתלה' };
    }
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
      if (shippingZone && !isQuote) {
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
          deliveryMethod,
          shippingAddress,
          totalAmount: total.toFixed(2),
          status: isQuote ? 'QUOTE_REQUESTED' : 'PENDING',
          paymentMethod,
          paymentReference,
          shippingZoneId: shippingZone?.id ?? null,
          shippingCost: shippingZone && !isQuote ? shippingCost.toFixed(2) : null,
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
  nursery: NonNullable<Awaited<ReturnType<typeof getNurseryByTenant>>>,
  isQuote: boolean,
): Promise<void> {
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
      deliveryMethod: order.deliveryMethod,
      shippingCost: order.shippingCost?.toString() ?? null,
      pickupAddress: [nursery.addressLine, nursery.city].filter(Boolean).join(', ') || null,
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
    const ownerRecipients = orderNotificationRecipients(nursery);

    const [customerRes, ownerRes] = await Promise.all([
      sendEmail({
        to: order.customerEmail,
        subject: customer.subject,
        html: customer.html,
        replyTo: nursery.contactEmail || nursery.ownerEmail,
      }),
      sendEmail({
        to: ownerRecipients,
        subject: owner.subject,
        html: owner.html,
        replyTo: order.customerEmail,
      }),
    ]);

    // תיעוד תוצאת השליחה — מאפשר לאבחן תקלות מייל מתוך הפורטל
    await recordAudit({
      nurseryId: nursery.id,
      action: 'order.emails',
      entityType: 'order',
      entityId: order.id,
      metadata: {
        customer: { to: order.customerEmail, ...customerRes },
        owner: { to: ownerRecipients, ...ownerRes },
      },
    });
  } catch (e) {
    console.error('[checkout] שליחת מיילים נכשלה', e);
  }
}
