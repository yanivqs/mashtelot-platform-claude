'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export interface SaveDeliveryState {
  ok?: boolean;
  error?: string;
}

/** הגדרות אופני הקבלה בחנות: איסוף עצמי / משלוח + הערה ללקוח. */
export async function saveDeliverySettings(
  _prev: SaveDeliveryState,
  formData: FormData,
): Promise<SaveDeliveryState> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);
  if (!nurseryId) return { error: 'אין משתלה משויכת' };

  const pickupEnabled = formData.get('pickupEnabled') === 'on';
  const deliveryEnabled = formData.get('deliveryEnabled') === 'on';
  if (!pickupEnabled && !deliveryEnabled) {
    return { error: 'יש להפעיל לפחות אפשרות אחת — איסוף עצמי או משלוח' };
  }
  const deliveryNote = String(formData.get('deliveryNote') || '').trim().slice(0, 300) || null;

  await prisma.nursery.update({
    where: { id: nurseryId },
    data: { pickupEnabled, deliveryEnabled, deliveryNote },
  });
  revalidatePath('/admin/settings');
  return { ok: true };
}
