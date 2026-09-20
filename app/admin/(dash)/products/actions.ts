'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

async function ownedProduct(
  productId: string,
): Promise<{ nurseryId: string; actorEmail: string | null }> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  const product = await prisma.nurseryProduct.findUnique({
    where: { id: productId },
    select: { nurseryId: true },
  });
  if (!product) throw new Error('המוצר לא נמצא');
  if (user.role !== 'SUPER_ADMIN' && product.nurseryId !== user.nurseryId) {
    throw new Error('אין הרשאה לערוך מוצר זה');
  }
  return { nurseryId: product.nurseryId, actorEmail: user.email };
}

function toDecimalString(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

export interface ProductFormState {
  ok?: boolean;
  error?: string;
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const id = String(formData.get('id') || '');
  try {
    const { nurseryId, actorEmail } = await ownedProduct(id);
    const before = await prisma.nurseryProduct.findUnique({
      where: { id },
      select: { price: true, stockQuantity: true },
    });

    const price = toDecimalString(formData.get('price'));
    if (!price) return { error: 'מחיר לא תקין' };

    const stock = parseInt(String(formData.get('stockQuantity') || '0'), 10);
    const nextStock = Number.isFinite(stock) && stock >= 0 ? stock : 0;

    await prisma.nurseryProduct.update({
      where: { id },
      data: {
        price,
        compareAtPrice: toDecimalString(formData.get('compareAtPrice')),
        stockQuantity: nextStock,
        isActive: formData.get('isActive') === 'on',
        customTitle: (String(formData.get('customTitle') || '').trim() || null),
        customDescription: (String(formData.get('customDescription') || '').trim() || null),
        seoMetaTitle: (String(formData.get('seoMetaTitle') || '').trim() || null),
        seoMetaDescription: (String(formData.get('seoMetaDescription') || '').trim() || null),
      },
    });

    if (before) {
      const priceChanged = before.price.toString() !== price;
      const stockChanged = before.stockQuantity !== nextStock;
      if (priceChanged || stockChanged) {
        await recordAudit({
          nurseryId,
          actorEmail,
          action: 'product.update',
          entityType: 'NurseryProduct',
          entityId: id,
          metadata: {
            ...(priceChanged ? { priceBefore: before.price.toString(), priceAfter: price } : {}),
            ...(stockChanged
              ? { stockBefore: before.stockQuantity, stockAfter: nextStock }
              : {}),
          },
        });
      }
    }

    revalidatePath('/admin/products');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'שגיאה בעדכון' };
  }
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await ownedProduct(id);
  await prisma.nurseryProduct.delete({ where: { id } });
  revalidatePath('/admin/products');
}
