'use server';

import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { getSalesMode } from '@/lib/sales';
import { resolveProductContent, tenantUrl } from '@/lib/seo';
import { rateLimit, clientIp } from '@/lib/rate-limit';
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
  couponCode?: string;
  items: Array<{ productId: string; quantity: number }>;
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

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      const products = await tx.nurseryProduct.findMany({
        where: { id: { in: cart.map((c) => c.productId) }, nurseryId: nursery.id, isActive: true },
        include: { plant: true, supply: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const lineItems = cart.map((c) => {
        const product = byId.get(c.productId);
        if (!product) throw new Error('אחד המוצרים בעגלה אינו זמין יותר');
        const { title } = resolveProductContent(product);
        // בבקשת הצעת מחיר אין התחייבות למלאי — בודקים רק הזמנה אונליין
        if (!isQuote && product.stockQuantity < c.quantity) {
          throw new Error(`אין מספיק מלאי עבור "${title}"`);
        }
        return {
          nurseryProductId: product.id,
          productTitle: title,
          quantity: c.quantity,
          unitPrice: product.price,
        };
      });

      let total = lineItems.reduce((sum, li) => sum + Number(li.unitPrice) * li.quantity, 0);

      if (!isQuote && input.couponCode?.trim()) {
        const coupon = await tx.coupon.findFirst({
          where: { nurseryId: nursery.id, code: input.couponCode.trim(), isActive: true },
        });
        if (!coupon) throw new Error('קוד קופון לא תקף');
        total = total * (1 - Number(coupon.discountPct) / 100);
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
