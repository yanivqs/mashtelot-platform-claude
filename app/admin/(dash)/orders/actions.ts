'use server';

import { revalidatePath } from 'next/cache';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { setPaymentStatus, transitionOrder } from '@/lib/order-service';

export interface OrderActionState {
  ok?: boolean;
  error?: string;
}

/** מעבר סטטוס טיפול — רק מעברים חוקיים (C-P1-02), כולל השפעות המלאי והקופון. */
export async function updateOrderStatus(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { user, nurseryId } = await requireNurseryAction({ all: ['orders'] });
  const orderId = String(formData.get('id') || '');
  const to = String(formData.get('status') || '') as OrderStatus;
  if (!orderId || !to) return { error: 'בקשה לא תקינה' };

  const res = await transitionOrder(prisma, { nurseryId, orderId, to, actorEmail: user.email });
  if (!res.ok) return { error: res.error };

  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'order.status_changed',
    entityType: 'Order',
    entityId: orderId,
    metadata: { from: res.from, to },
  });
  revalidatePath('/admin/orders');
  return { ok: true };
}

/** סטטוס תשלום — ציר נפרד מהטיפול (אפיון §9.04). */
export async function updatePaymentStatus(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { user, nurseryId } = await requireNurseryAction({ all: ['orders'] });
  const orderId = String(formData.get('id') || '');
  const to = String(formData.get('paymentStatus') || '') as PaymentStatus;
  if (!orderId || !to) return { error: 'בקשה לא תקינה' };

  const res = await setPaymentStatus(prisma, { nurseryId, orderId, to });
  if (!res.ok) return { error: res.error };

  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: to === 'PAID' ? 'order.payment_confirmed' : 'order.payment_status_changed',
    entityType: 'Order',
    entityId: orderId,
    metadata: { from: res.from, to },
  });
  revalidatePath('/admin/orders');
  return { ok: true };
}
