'use server';

import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { resolveProductContent } from '@/lib/seo';

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

  const nursery = await getNurseryByTenant(input.tenant);
  if (!nursery) return { error: 'המשתלה לא נמצאה' };

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
        if (product.stockQuantity < c.quantity) {
          const { title } = resolveProductContent(product);
          throw new Error(`אין מספיק מלאי עבור "${title}"`);
        }
        const { title } = resolveProductContent(product);
        return {
          nurseryProductId: product.id,
          productTitle: title,
          quantity: c.quantity,
          unitPrice: product.price,
        };
      });

      let total = lineItems.reduce((sum, li) => sum + Number(li.unitPrice) * li.quantity, 0);

      if (input.couponCode?.trim()) {
        const coupon = await tx.coupon.findFirst({
          where: { nurseryId: nursery.id, code: input.couponCode.trim(), isActive: true },
        });
        if (!coupon) throw new Error('קוד קופון לא תקף');
        total = total * (1 - Number(coupon.discountPct) / 100);
      }

      // ניכוי מלאי עם הגנה מפני מרוץ תנאים
      for (const li of lineItems) {
        const res = await tx.nurseryProduct.updateMany({
          where: { id: li.nurseryProductId, stockQuantity: { gte: li.quantity } },
          data: { stockQuantity: { decrement: li.quantity } },
        });
        if (res.count !== 1) throw new Error('המלאי השתנה בזמן ההזמנה, נסו שוב');
      }

      const order = await tx.order.create({
        data: {
          nurseryId: nursery.id,
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          shippingAddress: input.shippingAddress?.trim() || null,
          totalAmount: total.toFixed(2),
          status: 'PENDING',
          items: { create: lineItems },
        },
      });
      return order.id;
    });

    return { ok: true, orderId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'אירעה שגיאה ביצירת ההזמנה' };
  }
}
