'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';

export interface SaveDeliveryState {
  ok?: boolean;
  error?: string;
}

/** הגדרות אופני הקבלה בחנות: איסוף עצמי / משלוח + הערה ללקוח. */
export async function saveDeliverySettings(
  _prev: SaveDeliveryState,
  formData: FormData,
): Promise<SaveDeliveryState> {
  const scope = await nurseryActionScope({ all: ['sales'] });
  if (!scope.ok) return { error: scope.error };
  const { nurseryId } = scope;

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
