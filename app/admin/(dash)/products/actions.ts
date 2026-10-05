'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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

async function syncProductCategories(
  productId: string,
  nurseryId: string,
  rawIds: string[],
): Promise<void> {
  const owned = await prisma.nurseryCategory.findMany({
    where: { nurseryId, id: { in: rawIds } },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.nurseryProductCategory.deleteMany({ where: { nurseryProductId: productId } }),
    prisma.nurseryProductCategory.createMany({
      data: owned.map((c) => ({ nurseryProductId: productId, nurseryCategoryId: c.id })),
    }),
  ]);
}

function optionalUrl(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s || null;
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
        customImageUrl: optionalUrl(formData.get('customImageUrl')),
        seoMetaTitle: (String(formData.get('seoMetaTitle') || '').trim() || null),
        seoMetaDescription: (String(formData.get('seoMetaDescription') || '').trim() || null),
      },
    });

    await syncProductCategories(id, nurseryId, formData.getAll('categoryIds').map(String));

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

export async function createCustomProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  const nurseryId =
    user.nurseryId ??
    (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id;
  if (!nurseryId) return { error: 'אין משתלה משויכת' };

  const title = String(formData.get('customTitle') || '').trim();
  if (!title) return { error: 'יש להזין שם למוצר' };

  const price = toDecimalString(formData.get('price'));
  if (!price) return { error: 'מחיר לא תקין' };

  const stock = parseInt(String(formData.get('stockQuantity') || '0'), 10);

  const product = await prisma.nurseryProduct.create({
    data: {
      nurseryId,
      customTitle: title,
      price,
      compareAtPrice: toDecimalString(formData.get('compareAtPrice')),
      stockQuantity: Number.isFinite(stock) && stock >= 0 ? stock : 0,
      isActive: formData.get('isActive') === 'on',
      customDescription: (String(formData.get('customDescription') || '').trim() || null),
      customImageUrl: optionalUrl(formData.get('customImageUrl')),
      seoMetaTitle: (String(formData.get('seoMetaTitle') || '').trim() || null),
      seoMetaDescription: (String(formData.get('seoMetaDescription') || '').trim() || null),
    },
  });

  await syncProductCategories(product.id, nurseryId, formData.getAll('categoryIds').map(String));

  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  await ownedProduct(id);
  await prisma.nurseryProduct.delete({ where: { id } });
  revalidatePath('/admin/products');
}
