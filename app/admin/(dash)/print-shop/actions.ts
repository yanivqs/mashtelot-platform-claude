'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { parsePriceTiers, printLinePrice, type SelectedOption } from '@/lib/print-pricing';
import { recordAudit } from '@/lib/audit';
import { createTemplateOrder } from '@/lib/print-templates-admin';

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
  // הזמנת רכש B2B — של בעל המשתלה בלבד, כשמודול בית הדפוס פעיל (C-P1-01)
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { error: scope.error };
  const { user, nurseryId } = scope;

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

// ---------- הזמנה מתבנית (PT-02/03/07) ----------

export interface TemplateOrderInput {
  templateVersionId: string;
  values: Record<string, unknown>;
  quantity: number;
  notes?: string;
}

export interface TemplateOrderResult {
  ok?: boolean;
  orderId?: string;
  quoteOnly?: boolean;
  total?: number;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** הזמנת רכש מתבנית: הערכים והמחיר נבדקים ומחושבים מחדש בשרת מול הגרסה המפורסמת. */
export async function createTemplateOrderAction(input: TemplateOrderInput): Promise<TemplateOrderResult> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { error: scope.error };
  const res = await createTemplateOrder(prisma, {
    nurseryId: scope.nurseryId,
    userId: scope.user.id,
    templateVersionId: String(input.templateVersionId ?? ''),
    values: input.values && typeof input.values === 'object' ? input.values : {},
    quantity: Number(input.quantity),
    notes: typeof input.notes === 'string' ? input.notes : null,
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  await recordAudit({
    nurseryId: scope.nurseryId,
    actorEmail: scope.user.email,
    action: res.quote.quoteOnly ? 'print.quote_requested' : 'print.order_created',
    entityType: 'PrintOrder',
    entityId: res.orderId,
    metadata: { templateVersionId: input.templateVersionId, quantity: res.quote.quantity, total: res.quote.total },
  });
  revalidatePath('/admin/print-shop');
  revalidatePath('/admin/print-orders');
  return { ok: true, orderId: res.orderId, quoteOnly: res.quote.quoteOnly, total: res.quote.total };
}
