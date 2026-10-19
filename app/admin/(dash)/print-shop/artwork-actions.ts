'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { newStorageKey, signUploadTicket, storageDriver, verifyUploadTicket, type UploadTarget } from '@/lib/print-storage';
import { addArtworkVersion, attachProof, decideArtwork, ownsSubject, registerFile, type Subject } from '@/lib/print-artwork';
import { setProductionFile } from '@/lib/print-production';

export interface UploadStart {
  ok?: boolean;
  error?: string;
  target?: UploadTarget;
  ticket?: string;
}

function revalidateAll() {
  revalidatePath('/admin/print-shop');
  revalidatePath('/admin/print-artwork');
}

function toSubject(input: { savedProductId?: string | null; printOrderId?: string | null }): Subject | null {
  if (typeof input.savedProductId === 'string' && input.savedProductId) return { savedProductId: input.savedProductId };
  if (typeof input.printOrderId === 'string' && input.printOrderId) return { printOrderId: input.printOrderId };
  return null;
}

/** משתלה: קישור העלאה חתום לגרסת גרפיקה חדשה (מוצר קבוע או הזמנה שלה). */
export async function startArtworkUpload(input: { savedProductId?: string | null; printOrderId?: string | null }): Promise<UploadStart> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { error: scope.error };
  const subject = toSubject(input);
  if (!subject || !(await ownsSubject(prisma, scope.nurseryId, subject))) return { error: 'לא נמצא' };
  const key = newStorageKey(scope.nurseryId, 'ARTWORK');
  const ticket = await signUploadTicket({ key, nurseryId: scope.nurseryId, kind: 'ARTWORK', target: subject });
  try {
    return { ok: true, target: await storageDriver().uploadTarget(key, ticket), ticket };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'האחסון אינו זמין' };
  }
}

/** בית הדפוס: קישור העלאה חתום להגהה לגרסה. */
export async function startProofUpload(versionId: string): Promise<UploadStart> {
  await requireUser(['SUPER_ADMIN']);
  const v = await prisma.printArtworkVersion.findUnique({ where: { id: String(versionId) } });
  if (!v || v.status !== 'UPLOADED') return { error: 'אפשר לצרף הגהה רק לגרסה שממתינה להגהה' };
  const key = newStorageKey(v.nurseryId, 'PROOF');
  const ticket = await signUploadTicket({ key, nurseryId: v.nurseryId, kind: 'PROOF', target: { versionId: v.id } });
  try {
    return { ok: true, target: await storageDriver().uploadTarget(key, ticket), ticket };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'האחסון אינו זמין' };
  }
}

/** בית הדפוס: קישור העלאה חתום לקובץ הייצור של הזמנה (לפני שחרור בלבד). */
export async function startProductionUpload(orderId: string): Promise<UploadStart> {
  await requireUser(['SUPER_ADMIN']);
  const o = await prisma.printOrder.findUnique({ where: { id: String(orderId) }, select: { id: true, nurseryId: true, releasedAt: true } });
  if (!o) return { error: 'ההזמנה לא נמצאה' };
  if (o.releasedAt) return { error: 'ההזמנה כבר שוחררה — קובץ הייצור נעול' };
  const key = newStorageKey(o.nurseryId, 'PRODUCTION');
  const ticket = await signUploadTicket({ key, nurseryId: o.nurseryId, kind: 'PRODUCTION', target: { productionOrderId: o.id } });
  try {
    return { ok: true, target: await storageDriver().uploadTarget(key, ticket), ticket };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'האחסון אינו זמין' };
  }
}

/**
 * סיום העלאה: הכרטיס נבדק, הקובץ נקרא מהאחסון ונבדק לפי התוכן; קובץ לא תקין נמחק.
 * גרפיקה — רק בעל המשתלה של הכרטיס; הגהה — רק בית הדפוס.
 */
export async function finishUpload(input: { ticket: string; originalName: string }): Promise<{ ok?: boolean; error?: string }> {
  const t = await verifyUploadTicket(String(input.ticket ?? ''));
  if (!t) return { error: 'תוקף ההעלאה פג — נסו שוב' };

  let actorEmail: string | null = null;
  if (t.kind === 'ARTWORK') {
    const scope = await nurseryActionScope({ all: ['print_shop'] });
    if (!scope.ok || scope.nurseryId !== t.nurseryId) return { error: 'אין הרשאה' };
    actorEmail = scope.user.email;
  } else {
    // הגהה וקובץ ייצור — בית הדפוס בלבד
    actorEmail = (await requireUser(['SUPER_ADMIN'])).email;
  }

  const driver = storageDriver();
  const bytes = await driver.read(t.key);
  const reg = await registerFile(prisma, {
    nurseryId: t.nurseryId,
    kind: t.kind,
    storageKey: t.key,
    originalName: String(input.originalName ?? ''),
    bytes,
    actorEmail,
  });
  if (!reg.ok) {
    if (bytes) await driver.remove(t.key);
    return { error: reg.error };
  }

  if (t.kind === 'ARTWORK') {
    const subject = toSubject(t.target);
    const r = subject ? await addArtworkVersion(prisma, { nurseryId: t.nurseryId, subject, fileId: reg.fileId, actorEmail }) : null;
    if (!r?.ok) return { error: r?.error ?? 'שגיאה' };
    await recordAudit({ nurseryId: t.nurseryId, actorEmail, action: 'print.artwork_uploaded', entityType: 'PrintArtworkVersion', entityId: r.versionId, metadata: { version: r.version } });
  } else if (t.kind === 'PROOF') {
    const r = await attachProof(prisma, { versionId: String(t.target.versionId ?? ''), fileId: reg.fileId, actorEmail });
    if (!r.ok) return { error: r.error };
    await recordAudit({ nurseryId: t.nurseryId, actorEmail, action: 'print.proof_sent', entityType: 'PrintArtworkVersion', entityId: t.target.versionId });
  } else {
    const r = await setProductionFile(prisma, String(t.target.productionOrderId ?? ''), reg.fileId);
    if (!r.ok) return { error: r.error };
    await recordAudit({ nurseryId: t.nurseryId, actorEmail, action: 'print.production_file_uploaded', entityType: 'PrintOrder', entityId: t.target.productionOrderId, metadata: { fileId: reg.fileId } });
    revalidatePath('/admin/print-orders');
  }
  revalidateAll();
  return { ok: true };
}

export interface DecisionState {
  ok?: boolean;
  error?: string;
}

/** משתלה: אישור/דחיית הגהה לגרסה מסוימת. */
export async function ownerDecision(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const scope = await nurseryActionScope({ all: ['print_shop'] });
  if (!scope.ok) return { error: scope.error };
  const versionId = String(formData.get('versionId') || '');
  const approve = formData.get('decision') === 'approve';
  const r = await decideArtwork(prisma, { versionId, approve, method: 'OWNER', nurseryId: scope.nurseryId, actorEmail: scope.user.email, note: String(formData.get('note') || '') });
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: scope.nurseryId, actorEmail: scope.user.email, action: approve ? 'print.artwork_approved' : 'print.artwork_rejected', entityType: 'PrintArtworkVersion', entityId: versionId, metadata: { method: 'OWNER' } });
  revalidateAll();
  return { ok: true };
}

/** בית הדפוס: תיעוד אישור/דחייה טלפוניים של המשתלה (החלטת בעלים) — הערה חובה. */
export async function phoneDecision(_prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const versionId = String(formData.get('versionId') || '');
  const approve = formData.get('decision') === 'approve';
  const note = String(formData.get('note') || '');
  const r = await decideArtwork(prisma, { versionId, approve, method: 'PHONE', actorEmail: user.email, note });
  if (!r.ok) return { error: r.error };
  const v = await prisma.printArtworkVersion.findUnique({ where: { id: versionId }, select: { nurseryId: true } });
  await recordAudit({ nurseryId: v?.nurseryId, actorEmail: user.email, action: approve ? 'print.artwork_approved' : 'print.artwork_rejected', entityType: 'PrintArtworkVersion', entityId: versionId, metadata: { method: 'PHONE', note } });
  revalidateAll();
  return { ok: true };
}
