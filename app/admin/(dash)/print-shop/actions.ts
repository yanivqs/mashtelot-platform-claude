'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { parsePriceTiers, printLinePrice, type SelectedOption } from '@/lib/print-pricing';

export interface PrintOrderInput {
  items: Array<{ productId: string; quantity: number; customText?: string; optionIds?: string[] }>;
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

  const [products, allOptions] = await Promise.all([
    prisma.printProduct.findMany({
      where: { id: { in: lines.map((l) => l.productId) }, isActive: true },
    }),
    prisma.printGlobalOption.findMany(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const optionsById = new Map(allOptions.map((o) => [o.id, o]));
  const artworkUrl = input.artworkUrl?.trim() || null;

  const itemData: Prisma.PrintOrderItemCreateWithoutPrintOrderInput[] = [];
  let total = 0;
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) return { error: 'אחד המוצרים אינו זמין' };
    if (line.quantity < product.minQuantity) {
      return { error: `כמות מינימלית ל"${product.title}" היא ${product.minQuantity}` };
    }
    if (product.requiresArtwork && !artworkUrl) {
      return { error: `"${product.title}" דורש קובץ גרפי — יש להעלות קובץ לפני שליחה` };
    }

    // מחירי התוספות נלקחים מה-DB (לא מהלקוח)
    const selected: SelectedOption[] = product.allowOptions
      ? [...new Set(line.optionIds ?? [])]
          .map((id) => optionsById.get(id))
          .filter((o): o is NonNullable<typeof o> => Boolean(o))
          .map((o) => ({ name: o.optionName, extraPrice: Number(o.extraPrice) }))
      : [];

    const { unitPrice, total: lineTotal } = printLinePrice(
      Number(product.basePrice),
      parsePriceTiers(product.priceTiers),
      line.quantity,
      selected,
    );
    total += lineTotal;
    itemData.push({
      printProduct: { connect: { id: product.id } },
      quantity: line.quantity,
      unitPrice: unitPrice.toFixed(2),
      customText: line.customText?.trim() || null,
      options: selected.length ? (selected as unknown as Prisma.InputJsonValue) : undefined,
    });
  }

  const order = await prisma.printOrder.create({
    data: {
      nurseryId,
      orderedById: user.id,
      status: 'NEW',
      totalAmount: total.toFixed(2),
      notes: input.notes?.trim() || null,
      artworkUrl,
      items: { create: itemData },
    },
  });

  revalidatePath('/admin/print-shop');
  revalidatePath('/admin/print-orders');
  return { ok: true, orderId: order.id };
}
