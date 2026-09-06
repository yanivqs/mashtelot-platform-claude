'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

async function ownedProductNurseryId(productId: string): Promise<string> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  const product = await prisma.nurseryProduct.findUnique({
    where: { id: productId },
    select: { nurseryId: true },
  });
  if (!product) throw new Error('המוצר לא נמצא');
  if (user.role !== 'SUPER_ADMIN' && product.nurseryId !== user.nurseryId) {
    throw new Error('אין הרשאה לערוך מוצר זה');
  }
  return product.nurseryId;
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
    await ownedProductNurseryId(id);

    const price = toDecimalString(formData.get('price'));
    if (!price) return { error: 'מחיר לא תקין' };

    const stock = parseInt(String(formData.get('stockQuantity') || '0'), 10);

    await prisma.nurseryProduct.update({
      where: { id },
      data: {
        price,
        compareAtPrice: toDecimalString(formData.get('compareAtPrice')),
        stockQuantity: Number.isFinite(stock) && stock >= 0 ? stock : 0,
        isActive: formData.get('isActive') === 'on',
        customTitle: (String(formData.get('customTitle') || '').trim() || null),
        customDescription: (String(formData.get('customDescription') || '').trim() || null),
        seoMetaTitle: (String(formData.get('seoMetaTitle') || '').trim() || null),
        seoMetaDescription: (String(formData.get('seoMetaDescription') || '').trim() || null),
      },
    });

    revalidatePath('/admin/products');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'שגיאה בעדכון' };
  }
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await ownedProductNurseryId(id);
  await prisma.nurseryProduct.delete({ where: { id } });
  revalidatePath('/admin/products');
}
