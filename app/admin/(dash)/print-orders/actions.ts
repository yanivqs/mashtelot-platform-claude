'use server';

import { revalidatePath } from 'next/cache';
import type { PrintOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

const VALID: PrintOrderStatus[] = [
  'NEW',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export async function updatePrintOrderStatus(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as PrintOrderStatus;
  if (!id || !VALID.includes(status)) return;
  await prisma.printOrder.update({ where: { id }, data: { status } });
  revalidatePath('/admin/print-orders');
}

export interface PrintProductState {
  ok?: boolean;
  error?: string;
}

export async function createPrintProduct(
  _prev: PrintProductState,
  formData: FormData,
): Promise<PrintProductState> {
  await requireUser(['SUPER_ADMIN']);
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const basePrice = Number(String(formData.get('basePrice') || ''));
  const minQuantity = parseInt(String(formData.get('minQuantity') || '1'), 10);

  if (!title) return { error: 'יש להזין שם מוצר' };
  if (!Number.isFinite(basePrice) || basePrice <= 0) return { error: 'מחיר לא תקין' };

  await prisma.printProduct.create({
    data: {
      title,
      description: description || null,
      basePrice: basePrice.toFixed(2),
      minQuantity: Number.isFinite(minQuantity) && minQuantity > 0 ? minQuantity : 1,
    },
  });
  revalidatePath('/admin/print-orders');
  return { ok: true };
}

export async function togglePrintProduct(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const row = await prisma.printProduct.findUnique({ where: { id }, select: { isActive: true } });
  if (!row) return;
  await prisma.printProduct.update({ where: { id }, data: { isActive: !row.isActive } });
  revalidatePath('/admin/print-orders');
}
