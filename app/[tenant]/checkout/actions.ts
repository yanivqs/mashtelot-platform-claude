'use server';

import type { PaymentMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { getSalesMode } from '@/lib/sales';
import { tenantUrl } from '@/lib/seo';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { getEnabledPaymentMethods } from '@/lib/payment-access';
import {
  isMethodAllowedFor,
  isPaymentMethod,
  isPayOnSite,
  type EnabledPaymentMethod,
} from '@/lib/payment-methods';
import { resolveShippingZone, hasAnyShippingZone } from '@/lib/shipping';
import { normalizePostcode } from '@/lib/shipping-zones';
import { getCustomer } from '@/lib/customer-session';
import { isModuleEnabled } from '@/lib/module-access';
import { recordAudit } from '@/lib/audit';
import { createOrderRecord } from '@/lib/order-service';
import {
  CheckoutError,
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
  /** §11.01: אופציונלי; מיקוד שתואם אזור גובר על העיר */
  postcode?: string;
  couponCode?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  items: Array<{ productId: string; variantId?: string | null; quantity: number }>;
  /** מפתח ייחודי לניסיון checkout — ניסיון חוזר לא ייצור הזמנה שנייה */
  idempotencyKey?: string;
}

export interface CheckoutShippingZone {
  cities: string[];
  postcodes: string[];
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
  /** R06-03: לקוח מחובר — מילוי מראש */
  customer: { email: string; fullName: string | null; phone: string | null } | null;
}

/** לקוח מחובר בחנות הזו (רק כשמודול החשבונות פעיל). */
async function checkoutCustomer(nurseryId: string) {
  if (!(await isModuleEnabled(nurseryId, 'customer_accounts'))) return null;
  const c = await getCustomer(nurseryId);
  return c ? { email: c.email, fullName: c.fullName, phone: c.phone } : null;
}

/** כל מה שטופס ה-checkout צריך: אמצעי תשלום, אופני קבלה ואזורי משלוח. */
export async function getCheckoutOptions(tenant: string): Promise<CheckoutOptions | null> {
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) return null;
  const [paymentMethods, zones] = await Promise.all([
    getEnabledPaymentMethods(nursery.id),
    prisma.shippingZone.findMany({
      where: { nurseryId: nursery.id, isEnabled: true },
      include: { cities: true, postcodes: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  return {
    paymentMethods,
    deliveryMethods: availableDeliveryMethods(nursery),
    deliveryNote: nursery.deliveryNote,
    pickupAddress: [nursery.addressLine, nursery.city].filter(Boolean).join(', ') || null,
    customer: await checkoutCustomer(nursery.id),
    zones: zones
      .filter((z) => z.cities.length > 0 || z.postcodes.length > 0)
      .map((z) => ({
        cities: z.cities.map((c) => c.cityName),
        postcodes: z.postcodes.map((p) => p.prefix),
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
    (i) =>
      typeof i.productId === 'string' &&
      (i.variantId === undefined || i.variantId === null || typeof i.variantId === 'string') &&
      Number.isInteger(i.quantity) &&
      i.quantity > 0,
  );
  if (cart.length === 0) return { error: 'העגלה ריקה' };

  // הגבלת קצב לפי כתובת IP כדי לבלום הצפת הזמנות
  if (!(await rateLimit(`checkout:ip:${await clientIp()}`, 6, 10 * 60_000)).ok) {
    return { error: 'יותר מדי הזמנות בזמן קצר. נסו שוב מאוחר יותר.' };
  }

  const nursery = await getNurseryByTenant(input.tenant);
  if (!nursery) return { error: 'המשתלה לא נמצאה' };

  const salesMode = await getSalesMode(nursery.id);
  if (salesMode === 'DISABLED') {
    return { error: 'המשתלה אינה מקבלת הזמנות אונליין כרגע' };
  }
  const isQuote = salesMode === 'QUOTE';

  // אופן קבלה: איסוף עצמי / משלוח (לפי מה שהמשתלה מאפשרת)
  let deliveryMethod: DeliveryChoice;
  try {
    deliveryMethod = resolveDeliveryMethod(input.deliveryMethod, availableDeliveryMethods(nursery));
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'יש לבחור אופן קבלה' };
  }

  // אימות אמצעי תשלום מול האפשרויות הפעילות אצל המשתלה ומול אופן הקבלה
  // (לא סומכים על הקלט מהלקוח; "תשלום באיסוף" רק באיסוף, "תשלום לשליח" רק במשלוח)
  let paymentMethod: PaymentMethod | null = null;
  if (!isQuote && input.paymentMethod) {
    if (!isPaymentMethod(input.paymentMethod) || !isMethodAllowedFor(input.paymentMethod, deliveryMethod)) {
      return { error: 'אמצעי התשלום שנבחר אינו זמין לאופן הקבלה' };
    }
    const allowed = await prisma.nurseryPaymentMethod.findFirst({
      where: { nurseryId: nursery.id, method: input.paymentMethod, isEnabled: true },
    });
    if (allowed) paymentMethod = input.paymentMethod;
  }
  const paymentReference =
    !isQuote && !(paymentMethod && isPayOnSite(paymentMethod)) ? input.paymentReference?.trim() || null : null;

  let shippingAddress: string | null = null;
  let shippingPostcode: string | null = null;
  let shippingZone: Awaited<ReturnType<typeof resolveShippingZone>> = null;
  if (deliveryMethod === 'DELIVERY') {
    const street = input.shippingAddress?.trim();
    const city = input.city?.trim();
    if (!city) return { error: 'יש לבחור עיר למשלוח' };
    if (!street) return { error: 'יש למלא כתובת למשלוח' };
    const pc = normalizePostcode(input.postcode);
    if (pc === null) return { error: 'מיקוד לא תקין — 7 ספרות' };
    shippingPostcode = pc || null;
    shippingAddress = `${street}, ${city}${pc ? ` ${pc}` : ''}`;

    // אזור משלוח: רק אם למשתלה מוגדר לפחות אזור אחד; אחרת העלות מתואמת מול המשתלה
    if (await hasAnyShippingZone(nursery.id)) {
      shippingZone = await resolveShippingZone(nursery.id, city, shippingPostcode);
      if (!shippingZone) return { error: 'משלוח לא זמין לכתובת זו, צרו קשר עם המשתלה' };
    }
  }

  try {
    // יצירת ההזמנה, שמירת המלאי, הקופון וה-Snapshot — lib/order-service.ts (C-P1-02)
    const { orderId, reused } = await createOrderRecord(prisma, {
      nurseryId: nursery.id,
      isQuote,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      deliveryMethod,
      shippingAddress,
      shippingPostcode,
      shippingZone,
      customerId: await checkoutCustomerId(nursery.id, email),
      paymentMethod,
      paymentReference,
      couponCode: input.couponCode,
      items: cart,
      idempotencyKey: input.idempotencyKey,
    });

    // מיילים טרנזקציוניים — רק בהזמנה חדשה (ניסיון חוזר לא שולח שוב); לא מפילים את ההזמנה
    if (!reused) await sendOrderEmails(orderId, nursery, isQuote);

    return { ok: true, orderId };
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    // שגיאה טכנית — לא חושפים פרטים ללקוח (אפיון §13.06)
    console.error('[checkout] יצירת הזמנה נכשלה', e);
    return { error: 'אירעה שגיאה ביצירת ההזמנה. נסו שוב בעוד רגע.' };
  }
}

/**
 * R06-03: הזמנה של לקוח מחובר משויכת לחשבון — רק כשהמייל בהזמנה הוא המייל המאומת של החשבון
 * (מייל אחר = הזמנה עבור מישהו אחר; תשויך אליו אם יתחבר).
 */
async function checkoutCustomerId(nurseryId: string, email: string): Promise<string | null> {
  if (!(await isModuleEnabled(nurseryId, 'customer_accounts'))) return null;
  const c = await getCustomer(nurseryId);
  return c && c.email === email ? c.id : null;
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
