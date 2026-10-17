'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { PAYMENT_METHODS } from '@/lib/payment-methods';

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

  try {
    await prisma.$transaction(
      PAYMENT_METHODS.map((method) =>
        prisma.nurseryPaymentMethod.upsert({
          where: { nurseryId_method: { nurseryId, method } },
          create: {
            nurseryId,
            method,
            isEnabled: formData.get(`${method}_enabled`) === 'on',
            destination: String(formData.get(`${method}_destination`) || '').trim() || null,
            instructions: String(formData.get(`${method}_instructions`) || '').trim() || null,
          },
          update: {
            isEnabled: formData.get(`${method}_enabled`) === 'on',
            destination: String(formData.get(`${method}_destination`) || '').trim() || null,
            instructions: String(formData.get(`${method}_instructions`) || '').trim() || null,
          },
        }),
      ),
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'שמירת אפשרויות התשלום נכשלה' };
  }

  revalidatePath('/admin/settings');
  return { ok: true };
}
