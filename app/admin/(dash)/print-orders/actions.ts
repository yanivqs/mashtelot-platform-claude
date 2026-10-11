'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, type PrintOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { parsePriceTiers } from '@/lib/print-pricing';

const VALID: PrintOrderStatus[] = [
  'NEW',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

function revalidatePrint() {
  revalidatePath('/admin/print-orders');
  revalidatePath('/admin/print-orders/products');
  revalidatePath('/admin/print-shop');
}

export async function updatePrintOrderStatus(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as PrintOrderStatus;
  if (!id || !VALID.includes(status)) return;
  await prisma.printOrder.update({ where: { id }, data: { status } });
  revalidatePath('/admin/print-orders');
}

// ---------- מוצרי דפוס ----------

export interface PrintProductState {
  ok?: boolean;
  error?: string;
}

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) || '').trim();
  return v || null;
}

/** יצירה / עדכון של מוצר דפוס (id = 'new' ליצירה). */
export async function savePrintProduct(
  _prev: PrintProductState,
  formData: FormData,
): Promise<PrintProductState> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || 'new');

  const title = str(formData, 'title');
  if (!title) return { error: 'יש להזין שם מוצר' };

  const basePrice = Number(String(formData.get('basePrice') || ''));
  if (!Number.isFinite(basePrice) || basePrice <= 0) return { error: 'מחיר בסיס לא תקין' };

  const minQuantity = parseInt(String(formData.get('minQuantity') || '1'), 10);
  if (!Number.isInteger(minQuantity) || minQuantity < 1) return { error: 'כמות מינימלית לא תקינה' };

  const leadRaw = str(formData, 'leadTimeDays');
  const leadTimeDays = leadRaw === null ? null : parseInt(leadRaw, 10);
  if (leadTimeDays !== null && (!Number.isInteger(leadTimeDays) || leadTimeDays < 0)) {
    return { error: 'זמן אספקה לא תקין' };
  }

  let tiersJson: unknown = [];
  try {
    tiersJson = JSON.parse(String(formData.get('priceTiers') || '[]'));
  } catch {
    return { error: 'מדרגות מחיר לא תקינות' };
  }
  const tiers = parsePriceTiers(tiersJson);

  const data = {
    title,
    category: str(formData, 'category'),
    description: str(formData, 'description'),
    specs: str(formData, 'specs'),
    imageUrl: str(formData, 'imageUrl'),
    basePrice: basePrice.toFixed(2),
    unitLabel: str(formData, 'unitLabel'),
    minQuantity,
    leadTimeDays,
    priceTiers: tiers.length ? (tiers as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    requiresArtwork: formData.get('requiresArtwork') === 'on',
    allowOptions: formData.get('allowOptions') === 'on',
    isActive: formData.get('isActive') === 'on',
    sortOrder: parseInt(String(formData.get('sortOrder') || '0'), 10) || 0,
  };

  if (id === 'new') {
    await prisma.printProduct.create({ data });
  } else {
    await prisma.printProduct.update({ where: { id }, data });
  }
  revalidatePrint();
  redirect('/admin/print-orders/products');
}

export async function togglePrintProduct(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const row = await prisma.printProduct.findUnique({ where: { id }, select: { isActive: true } });
  if (!row) return;
  await prisma.printProduct.update({ where: { id }, data: { isActive: !row.isActive } });
  revalidatePrint();
}

/** שכפול מוצר (כבוי, לעריכה) — נוח ליצירת וריאציות גודל/חומר. */
export async function duplicatePrintProduct(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const src = await prisma.printProduct.findUnique({ where: { id } });
  if (!src) return;
  const { id: _id, createdAt: _c, updatedAt: _u, priceTiers, ...rest } = src;
  const copy = await prisma.printProduct.create({
    data: {
      ...rest,
      priceTiers: priceTiers === null ? Prisma.JsonNull : (priceTiers as Prisma.InputJsonValue),
      title: `${src.title} (עותק)`,
      isActive: false,
    },
  });
  revalidatePrint();
  redirect(`/admin/print-orders/products/${copy.id}`);
}

/** מחיקה — רק אם לא הוזמן מעולם; אחרת מכבה (כדי לשמור היסטוריית הזמנות). */
export async function deletePrintProduct(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const used = await prisma.printOrderItem.count({ where: { printProductId: id } });
  if (used > 0) {
    await prisma.printProduct.update({ where: { id }, data: { isActive: false } });
  } else {
    await prisma.printProduct.delete({ where: { id } }).catch(() => undefined);
  }
  revalidatePrint();
  redirect('/admin/print-orders/products');
}

// ---------- אפשרויות גימור גלובליות ----------

export async function savePrintOption(
  _prev: PrintProductState,
  formData: FormData,
): Promise<PrintProductState> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const optionName = str(formData, 'optionName');
  const extraPrice = Number(String(formData.get('extraPrice') || ''));
  if (!optionName) return { error: 'יש להזין שם' };
  if (!Number.isFinite(extraPrice) || extraPrice < 0) return { error: 'תוספת מחיר לא תקינה' };

  const data = { optionName, extraPrice: extraPrice.toFixed(2) };
  if (id) await prisma.printGlobalOption.update({ where: { id }, data });
  else await prisma.printGlobalOption.create({ data });
  revalidatePrint();
  return { ok: true };
}

export async function deletePrintOption(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  await prisma.printGlobalOption.delete({ where: { id } }).catch(() => undefined);
  revalidatePrint();
}
