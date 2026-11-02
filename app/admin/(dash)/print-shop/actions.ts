'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { parsePriceTiers, printLinePrice, type SelectedOption } from '@/lib/print-pricing';
import { recordAudit } from '@/lib/audit';
import { archiveSaved, orderSaved } from '@/lib/print-saved';
import { createJobOrder, decideQuote, renameJob } from '@/lib/print-jobs';

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

export interface JobOrderActionResult {
  ok?: boolean;
  orderId?: string;
  name?: string;
  quoteOnly?: boolean;
  total?: number;
  perUnit?: number;
  reasons?: string[];
  error?: string;
  fieldErrors?: Record<string, string>;
  missing?: string[];
}

/** שליחה מהמחשבון: הכול נבדק ומחושב מחדש בשרת, ונוצרת עבודה עם הזמנה. */
export async function createJobOrderAction(input: {
  templateVersionId: string;
  values: Record<string, unknown>;
  quantity: number;
  notes?: string;
  fileId?: string | null;
  needsDesign?: boolean;
}): Promise<JobOrderActionResult> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { error: scope.error };
  const res = await createJobOrder(prisma, {
    nurseryId: scope.nurseryId,
    userId: scope.user.id,
    actorEmail: scope.user.email,
    templateVersionId: String(input.templateVersionId ?? ''),
    values: input.values && typeof input.values === 'object' ? input.values : {},
    quantity: Number(input.quantity),
    notes: typeof input.notes === 'string' ? input.notes : null,
    fileId: typeof input.fileId === 'string' ? input.fileId : null,
    needsDesign: input.needsDesign === true,
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors, missing: res.missing };
  await recordAudit({
    nurseryId: scope.nurseryId,
    actorEmail: scope.user.email,
    action: res.quote.quoteOnly ? 'print.quote_requested' : 'print.order_created',
    entityType: 'PrintOrder',
    entityId: res.orderId,
    metadata: { templateVersionId: input.templateVersionId, quantity: res.quote.quantity, total: res.quote.total, reasons: res.quote.reasons },
  });
  revalidatePath('/admin/print-shop/jobs');
  revalidatePath('/admin/print-orders');
  revalidatePath('/admin/print-specs');
  revalidatePath('/admin/print-artwork');
  return { ok: true, orderId: res.orderId, name: res.name, quoteOnly: res.quote.quoteOnly, total: res.quote.total, perUnit: res.quote.perUnit, reasons: res.quote.reasons };
}

export async function renameJobAction(input: { savedProductId: string; name: string }): Promise<{ ok: boolean }> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { ok: false };
  const ok = await renameJob(prisma, scope.nurseryId, String(input.savedProductId ?? ''), String(input.name ?? ''));
  if (ok) revalidatePath('/admin/print-shop/jobs');
  return { ok };
}

/** המשתלה עונה להצעת מחיר. */
export async function decideQuoteAction(input: { orderId: string; approve: boolean }): Promise<{ ok: boolean; error?: string }> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { ok: false, error: scope.error };
  const orderId = String(input.orderId ?? '');
  const approve = input.approve === true;
  const r = await decideQuote(prisma, { orderId, nurseryId: scope.nurseryId, approve });
  if (!r.ok) return r;
  await recordAudit({ nurseryId: scope.nurseryId, actorEmail: scope.user.email, action: approve ? 'print.quote_approved' : 'print.quote_declined', entityType: 'PrintOrder', entityId: orderId });
  revalidatePath('/admin/print-shop/jobs');
  revalidatePath('/admin/print-orders');
  return r;
}

export interface ReorderResult {
  ok?: boolean;
  error?: string;
  total?: number;
  quoteOnly?: boolean;
}

/** הזמנה חוזרת ממוצר קבוע מאושר — כמות והערות בלבד. */
export async function reorderSavedAction(input: { savedProductId: string; quantity: number; notes?: string }): Promise<ReorderResult> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { error: scope.error };
  const res = await orderSaved(prisma, {
    nurseryId: scope.nurseryId,
    userId: scope.user.id,
    savedProductId: String(input.savedProductId ?? ''),
    quantity: Number(input.quantity),
    notes: typeof input.notes === 'string' ? input.notes : null,
  });
  if (!res.ok) return { error: res.error };
  await recordAudit({
    nurseryId: scope.nurseryId,
    actorEmail: scope.user.email,
    action: 'print.reorder',
    entityType: 'PrintOrder',
    entityId: res.orderId,
    metadata: { savedProductId: input.savedProductId, quantity: res.quote.quantity, total: res.quote.total },
  });
  revalidatePath('/admin/print-shop/jobs');
  revalidatePath('/admin/print-orders');
  return { ok: true, total: res.quote.total, quoteOnly: res.quote.quoteOnly };
}

export async function archiveSavedAction(formData: FormData): Promise<void> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return;
  const id = String(formData.get('id') || '');
  if (await archiveSaved(prisma, scope.nurseryId, id)) {
    await recordAudit({ nurseryId: scope.nurseryId, actorEmail: scope.user.email, action: 'print.saved_archived', entityType: 'PrintSavedProduct', entityId: id });
  }
  revalidatePath('/admin/print-shop');
  revalidatePath('/admin/print-shop/jobs');
}
