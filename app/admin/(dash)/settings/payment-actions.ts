'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { PAYMENT_METHODS, PAYMENT_DESTINATION_LABELS, PAYMENT_METHOD_LABELS, validatePaymentDestination } from '@/lib/payment-methods';

/** הקשר המשתלה של המשתמש המחובר בלבד + אכיפת המודול (C-P1-01). */
async function resolveNurseryId(): Promise<string> {
  return (await requireNurseryAction({ all: ['sales'] })).nurseryId;
}

export interface SavePaymentMethodsState {
  ok?: boolean;
  error?: string;
}

export async function savePaymentMethods(
  _prev: SavePaymentMethodsState,
  formData: FormData,
): Promise<SavePaymentMethodsState> {
  const nurseryId = await resolveNurseryId();

  const read = (method: (typeof PAYMENT_METHODS)[number]) => ({
    isEnabled: formData.get(`${method}_enabled`) === 'on',
    // לאמצעי תשלום במקום אין יעד
    destination: PAYMENT_DESTINATION_LABELS[method]
      ? String(formData.get(`${method}_destination`) || '').trim() || null
      : null,
    instructions: String(formData.get(`${method}_instructions`) || '').trim() || null,
  });
  for (const method of PAYMENT_METHODS) {
    const err = validatePaymentDestination(method, read(method).destination);
    if (err) return { error: `${PAYMENT_METHOD_LABELS[method]}: ${err}` };
  }

  try {
    await prisma.$transaction(
      PAYMENT_METHODS.map((method) =>
        prisma.nurseryPaymentMethod.upsert({
          where: { nurseryId_method: { nurseryId, method } },
          create: { nurseryId, method, ...read(method) },
          update: read(method),
        }),
      ),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'שמירת אפשרויות התשלום נכשלה' };
  }

  revalidatePath('/admin/settings');
  return { ok: true };
}
