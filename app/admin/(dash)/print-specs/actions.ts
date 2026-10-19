'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { reviewSpec } from '@/lib/print-saved';

export interface ReviewState {
  ok?: boolean;
  error?: string;
}

/** אישור / דחיית מפרט מוצר קבוע בידי בית הדפוס (אישור 1 מתוך 3, נספח א.7). */
export async function reviewSpecAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const revisionId = String(formData.get('revisionId') || '');
  const approve = formData.get('decision') === 'approve';
  const note = String(formData.get('note') || '');
  const res = await reviewSpec(prisma, { revisionId, approve, note, actorEmail: user.email });
  if (!res.ok) return { error: res.error };
  const rev = await prisma.printSavedRevision.findUnique({ where: { id: revisionId }, select: { nurseryId: true, savedProductId: true, revision: true } });
  await recordAudit({
    nurseryId: rev?.nurseryId,
    actorEmail: user.email,
    action: approve ? 'print.spec_approved' : 'print.spec_rejected',
    entityType: 'PrintSavedProduct',
    entityId: rev?.savedProductId,
    metadata: { revision: rev?.revision, note: note || undefined },
  });
  revalidatePath('/admin/print-specs');
  revalidatePath('/admin/print-shop');
  return { ok: true };
}
