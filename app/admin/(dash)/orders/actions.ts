'use server';

import { revalidatePath } from 'next/cache';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { deleteOrder, setPaymentStatus, transitionOrder } from '@/lib/order-service';

const MAX_ORDER_NOTE = 2000;

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

/** הערה פנימית להזמנה (רק בניהול). */
export async function saveOrderNote(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const { user, nurseryId } = await requireNurseryAction({ all: ['orders'] });
  const orderId = String(formData.get('id') || '');
  const note = String(formData.get('note') ?? '').trim();
  if (!orderId) return { error: 'בקשה לא תקינה' };
  if (note.length > MAX_ORDER_NOTE) return { error: `ההערה ארוכה מדי (עד ${MAX_ORDER_NOTE} תווים)` };

  const res = await prisma.order.updateMany({ where: { id: orderId, nurseryId }, data: { adminNote: note || null } });
  if (res.count !== 1) return { error: 'ההזמנה לא נמצאה' };
  await recordAudit({ nurseryId, actorEmail: user.email, action: 'order.note_updated', entityType: 'Order', entityId: orderId });
  revalidatePath('/admin/orders');
  return { ok: true };
}

/** מחיקת הזמנה לצמיתות — כולל ביטול (מלאי/קופון) וקיזוז נקודות המועדון. */
export async function deleteOrderAction(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const { user, nurseryId } = await requireNurseryAction({ all: ['orders'] });
  const orderId = String(formData.get('id') || '');
  if (!orderId) return { error: 'בקשה לא תקינה' };
  if (formData.get('confirm') !== 'DELETE') return { error: 'יש לאשר את המחיקה' };

  const res = await deleteOrder(prisma, { nurseryId, orderId, actorEmail: user.email });
  if (!res.ok) return { error: res.error };
  await recordAudit({ nurseryId, actorEmail: user.email, action: 'order.deleted', entityType: 'Order', entityId: orderId, metadata: res.snapshot });
  revalidatePath('/admin/orders');
  return { ok: true };
}
