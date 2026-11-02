'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { archiveSaved, orderSaved } from '@/lib/print-saved';
import { createJobOrder, decideQuote, renameJob } from '@/lib/print-jobs';
import { reorderImportedJob } from '@/lib/print-import';

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

/** הזמנה חוזרת של עבודה קודמת בלי מוצר מהקטלוג: בקשת הצעת מחיר. */
export async function reorderImportedAction(input: { savedProductId: string; quantity: number; notes?: string }): Promise<{ ok?: boolean; error?: string }> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { error: scope.error };
  const res = await reorderImportedJob(prisma, {
    nurseryId: scope.nurseryId,
    userId: scope.user.id,
    savedProductId: String(input.savedProductId ?? ''),
    quantity: Number(input.quantity),
    notes: typeof input.notes === 'string' ? input.notes : null,
  });
  if (!res.ok) return { error: res.error };
  await recordAudit({ nurseryId: scope.nurseryId, actorEmail: scope.user.email, action: 'print.quote_requested', entityType: 'PrintOrder', entityId: res.orderId, metadata: { savedProductId: input.savedProductId, quantity: input.quantity, imported: true } });
  revalidatePath('/admin/print-shop/jobs');
  revalidatePath('/admin/print-orders');
  return { ok: true };
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
