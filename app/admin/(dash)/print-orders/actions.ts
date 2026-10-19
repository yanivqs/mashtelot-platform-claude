'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma, type PrintOrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { parsePriceTiers } from '@/lib/print-pricing';
import { recordAudit } from '@/lib/audit';

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

// ---------- הצעת מחיר (PT-07: "הצעת מחיר בלבד") ----------

export interface QuoteState {
  ok?: boolean;
  error?: string;
}

/** קביעת מחיר לבקשת הצעת מחיר: ההזמנה עוברת ל"התקבלה" במחיר שנקבע; מתועד ב-Audit. */
export async function setQuotePrice(_prev: QuoteState, formData: FormData): Promise<QuoteState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const total = Number(String(formData.get('total') || ''));
  if (!Number.isFinite(total) || total <= 0) return { error: 'יש להזין סכום גדול מ-0' };

  const order = await prisma.printOrder.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.status !== 'QUOTE_REQUESTED') return { error: 'ההזמנה אינה ממתינה להצעת מחיר' };
  const units = order.items.reduce((s, i) => s + i.quantity, 0) || 1;

  // מותנה בסטטוס — שתי קביעות מקבילות לא יחולו פעמיים
  const res = await prisma.$transaction(async (tx) => {
    const r = await tx.printOrder.updateMany({
      where: { id, status: 'QUOTE_REQUESTED' },
      data: { status: 'NEW', totalAmount: total.toFixed(2) },
    });
    if (r.count !== 1) return false;
    for (const it of order.items) {
      await tx.printOrderItem.update({ where: { id: it.id }, data: { unitPrice: (total / units).toFixed(2) } });
    }
    return true;
  });
  if (!res) return { error: 'ההזמנה עודכנה במקביל — רעננו' };
  await recordAudit({
    nurseryId: order.nurseryId,
    actorEmail: user.email,
    action: 'print.quote_priced',
    entityType: 'PrintOrder',
    entityId: id,
    metadata: { total },
  });
  revalidatePrint();
  return { ok: true };
}
