'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requireAnyModule } from '@/lib/module-access';

async function ownedCategory(categoryId: string): Promise<string> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireAnyModule(['plant_catalog', 'supplies']);
  const cat = await prisma.nurseryCategory.findUnique({
    where: { id: categoryId },
    select: { nurseryId: true },
  });
  if (!cat) throw new Error('הקטגוריה לא נמצאה');
  if (user.role !== 'SUPER_ADMIN' && cat.nurseryId !== user.nurseryId) {
    throw new Error('אין הרשאה');
  }
  return cat.nurseryId;
}

async function ownedProduct(productId: string, nurseryId: string): Promise<void> {
  const p = await prisma.nurseryProduct.findUnique({
    where: { id: productId },
    select: { nurseryId: true },
  });
  if (!p || p.nurseryId !== nurseryId) throw new Error('המוצר לא שייך למשתלה');
}

/** מסדר מחדש את כל השיוכים הישירים של הקטגוריה לפי רצף נקי (0..n-1). */
async function renumber(categoryId: string, orderedProductIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedProductIds.map((productId, index) =>
      prisma.nurseryProductCategory.update({
        where: { nurseryProductId_nurseryCategoryId: { nurseryProductId: productId, nurseryCategoryId: categoryId } },
        data: { sortOrder: index },
      }),
    ),
  );
}

async function directOrder(categoryId: string): Promise<string[]> {
  const rows = await prisma.nurseryProductCategory.findMany({
    where: { nurseryCategoryId: categoryId },
    orderBy: [{ sortOrder: 'asc' }, { nurseryProductId: 'asc' }],
    select: { nurseryProductId: true },
  });
  return rows.map((r) => r.nurseryProductId);
}

export async function moveProductInCategory(formData: FormData): Promise<void> {
  const categoryId = String(formData.get('categoryId') || '');
  const productId = String(formData.get('productId') || '');
  const direction = String(formData.get('direction') || '');
  await ownedCategory(categoryId);

  const order = await directOrder(categoryId);
  const i = order.indexOf(productId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  await renumber(categoryId, order);

  revalidatePath(`/admin/products/categories/${categoryId}`);
}

export async function removeProductFromCategory(formData: FormData): Promise<void> {
  const categoryId = String(formData.get('categoryId') || '');
  const productId = String(formData.get('productId') || '');
  await ownedCategory(categoryId);
  await prisma.nurseryProductCategory.deleteMany({
    where: { nurseryCategoryId: categoryId, nurseryProductId: productId },
  });
  await renumber(categoryId, await directOrder(categoryId));
  revalidatePath(`/admin/products/categories/${categoryId}`);
  revalidatePath('/admin/products');
}

export async function addProductToCategory(formData: FormData): Promise<void> {
  const categoryId = String(formData.get('categoryId') || '');
  const productId = String(formData.get('productId') || '');
  const nurseryId = await ownedCategory(categoryId);
  await ownedProduct(productId, nurseryId);

  const order = await directOrder(categoryId);
  if (!order.includes(productId)) {
    await prisma.nurseryProductCategory.create({
      data: { nurseryCategoryId: categoryId, nurseryProductId: productId, sortOrder: order.length },
    });
  }
  revalidatePath(`/admin/products/categories/${categoryId}`);
  revalidatePath('/admin/products');
}
