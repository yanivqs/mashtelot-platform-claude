'use server';

import { revalidatePath } from 'next/cache';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';

const VALID: OrderStatus[] = [
  'QUOTE_REQUESTED',
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const { user, nurseryId } = await requireNurseryAction({ all: ['orders'] });
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as OrderStatus;
  if (!id || !VALID.includes(status)) return;

  // רק הזמנה של המשתלה עצמה; הזמנה של משתלה אחרת = לא נמצאה
  const order = await prisma.order.findFirst({
    where: { id, nurseryId },
    select: { nurseryId: true, status: true },
  });
  if (!order) return;

  await prisma.order.update({ where: { id }, data: { status } });

  if (status === 'PAID' && order.status !== 'PAID') {
    await recordAudit({
      nurseryId: order.nurseryId,
      actorEmail: user.email,
      action: 'order.payment_confirmed',
      entityType: 'Order',
      entityId: id,
    });
  }

  revalidatePath('/admin/orders');
}
