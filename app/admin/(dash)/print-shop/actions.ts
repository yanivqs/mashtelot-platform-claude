'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export interface PrintOrderInput {
  items: Array<{ productId: string; quantity: number; customText?: string }>;
  notes?: string;
  artworkUrl?: string;
}

export interface PrintOrderResult {
  ok?: boolean;
  orderId?: string;
  error?: string;
}

export async function createPrintOrder(input: PrintOrderInput): Promise<PrintOrderResult> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);
  if (!nurseryId) return { error: 'אין משתלה משויכת' };

  const lines = (input.items ?? []).filter(
    (i) => i.productId && Number.isInteger(i.quantity) && i.quantity > 0,
  );
  if (lines.length === 0) return { error: 'לא נבחרו פריטים' };

  const products = await prisma.printProduct.findMany({
    where: { id: { in: lines.map((l) => l.productId) }, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const itemData = [];
  let total = 0;
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) return { error: 'אחד המוצרים אינו זמין' };
    if (line.quantity < product.minQuantity) {
      return { error: `כמות מינימלית ל"${product.title}" היא ${product.minQuantity}` };
    }
    total += Number(product.basePrice) * line.quantity;
    itemData.push({
      printProductId: product.id,
      quantity: line.quantity,
      unitPrice: product.basePrice,
      customText: line.customText?.trim() || null,
    });
  }

  const order = await prisma.printOrder.create({
    data: {
      nurseryId,
      orderedById: user.id,
      status: 'NEW',
      totalAmount: total.toFixed(2),
      notes: input.notes?.trim() || null,
      artworkUrl: input.artworkUrl?.trim() || null,
      items: { create: itemData },
    },
  });

  revalidatePath('/admin/print-shop');
  revalidatePath('/admin/print-orders');
  return { ok: true, orderId: order.id };
}
