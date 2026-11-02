'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { addImportedOrder, createImportedJob, deleteImportedJob, parsePastDate, updateImportedJob, type ImportedOrderInput } from '@/lib/print-import';
import { newStorageKey, signUploadTicket, storageDriver } from '@/lib/print-storage';
import type { UploadStart } from '../print-shop/artwork-actions';

export interface ImportState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function revalidate() {
  revalidatePath('/admin/print-jobs');
  revalidatePath('/admin/print-shop/jobs');
  revalidatePath('/admin/print-shop');
}

function readOrder(input: { date: unknown; quantity: unknown; price: unknown }): ImportedOrderInput | { error: string } {
  const date = parsePastDate(input.date);
  if (!date) return { error: 'תאריך הזמנה לא תקין (לא בעתיד)' };
  const priceRaw = String(input.price ?? '').trim();
  return { date, quantity: Number(input.quantity), price: priceRaw ? Number(priceRaw) : null };
}

export async function createImportedJobAction(input: {
  nurseryId: string;
  name: string;
  description: string;
  templateId: string;
  values: Record<string, unknown>;
  date: string;
  quantity: string;
  price: string;
}): Promise<ImportState & { id?: string }> {
  const user = await requireUser(['SUPER_ADMIN']);
  const order = readOrder(input);
  if ('error' in order) return { error: order.error };
  const r = await createImportedJob(prisma, {
    nurseryId: String(input.nurseryId ?? ''),
    actorEmail: user.email,
    name: String(input.name ?? ''),
    description: String(input.description ?? ''),
    templateId: input.templateId || null,
    values: input.values && typeof input.values === 'object' ? input.values : {},
    order,
  });
  if (!r.ok) return { error: r.error, fieldErrors: r.fieldErrors };
  await recordAudit({ nurseryId: input.nurseryId, actorEmail: user.email, action: 'print.job_imported', entityType: 'PrintSavedProduct', entityId: r.savedProductId, metadata: { name: input.name } });
  revalidate();
  return { ok: true, id: r.savedProductId };
}

export async function addImportedOrderAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(fd.get('id') || '');
  const order = readOrder({ date: fd.get('date'), quantity: fd.get('quantity'), price: fd.get('price') });
  if ('error' in order) return { error: order.error };
  const r = await addImportedOrder(prisma, id, order);
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: r.nurseryId, actorEmail: user.email, action: 'print.job_order_imported', entityType: 'PrintSavedProduct', entityId: id, metadata: { quantity: order.quantity, price: order.price } });
  revalidate();
  return { ok: true };
}

export async function updateImportedJobAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(fd.get('id') || '');
  const r = await updateImportedJob(prisma, id, { name: String(fd.get('name') ?? ''), description: String(fd.get('description') ?? '') });
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: r.nurseryId, actorEmail: user.email, action: 'print.job_import_updated', entityType: 'PrintSavedProduct', entityId: id });
  revalidate();
  return { ok: true };
}

export async function deleteImportedJobAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(fd.get('id') || '');
  const r = await deleteImportedJob(prisma, id);
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: r.nurseryId, actorEmail: user.email, action: 'print.job_import_deleted', entityType: 'PrintSavedProduct', entityId: id });
  revalidate();
  return { ok: true };
}

/** העלאת קובץ העבודה לאחסון הפרטי של המשתלה. */
export async function startImportedUpload(savedProductId: string): Promise<UploadStart> {
  await requireUser(['SUPER_ADMIN']);
  const job = await prisma.printSavedProduct.findFirst({ where: { id: String(savedProductId), importedAt: { not: null } }, select: { id: true, nurseryId: true } });
  if (!job) return { error: 'העבודה לא נמצאה' };
  const key = newStorageKey(job.nurseryId, 'ARTWORK');
  const ticket = await signUploadTicket({ key, nurseryId: job.nurseryId, kind: 'ARTWORK', target: { importedJobId: job.id, byPrintHouse: 'true' } });
  try {
    return { ok: true, target: await storageDriver().uploadTarget(key, ticket), ticket };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'האחסון אינו זמין' };
  }
}
