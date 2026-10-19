'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { applySync, restoreSyncField } from '@/lib/catalog-sync-admin';

export interface SyncFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function revalidateAll() {
  revalidatePath('/admin/catalog-updates');
  revalidatePath('/admin/products');
  revalidatePath('/admin');
}

/** אישור הצעה: שדות שסומנו — מתעדכנים; שדות שלא סומנו — נשמרים מקומית ולא יוצעו עוד (Q1-א). */
export async function applySyncAction(_prev: SyncFormState, formData: FormData): Promise<SyncFormState> {
  const { user, nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  const productId = String(formData.get('productId') || '');
  const toRevisionId = String(formData.get('toRevisionId') || '');
  const offered = formData.getAll('offered').map(String);
  const accept = new Set(formData.getAll('accept').map(String));
  const rejectFields = offered.filter((f) => !accept.has(f));

  const res = await applySync(prisma, { nurseryId, productId, toRevisionId, rejectFields, actorEmail: user.email });
  if (!res.ok) return { error: res.error };
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'catalog.sync_applied',
    entityType: 'NurseryProduct',
    entityId: productId,
    metadata: { accepted: res.accepted, rejected: res.rejected },
  });
  revalidateAll();
  return {
    ok: true,
    message: res.rejected.length
      ? `עודכן ✓ — ${res.rejected.length} שדות נשמרו מקומית`
      : 'עודכן ✓',
  };
}

/** החזרת שדה מקומי לסנכרון — המוצר יציג את ערך הקטלוג המאושר. */
export async function restoreFieldAction(formData: FormData): Promise<void> {
  const { user, nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  const productId = String(formData.get('productId') || '');
  const field = String(formData.get('field') || '');
  const res = await restoreSyncField(prisma, { nurseryId, productId, field, actorEmail: user.email });
  if (res.ok) {
    await recordAudit({
      nurseryId,
      actorEmail: user.email,
      action: 'catalog.sync_field_restored',
      entityType: 'NurseryProduct',
      entityId: productId,
      metadata: { field },
    });
  }
  revalidateAll();
}
