'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { assertOwnedBy } from '@/lib/ownership';
import { recordAudit } from '@/lib/audit';

async function ownedCategory(categoryId: string): Promise<string> {
  const { nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  await assertOwnedBy(prisma, 'nurseryCategory', categoryId, nurseryId);
  return nurseryId;
}

async function ownedProduct(productId: string, nurseryId: string): Promise<void> {
  await assertOwnedBy(prisma, 'nurseryProduct', productId, nurseryId);
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
  const position = parseInt(String(formData.get('position') || ''), 10);
  await ownedCategory(categoryId);

  const order = await directOrder(categoryId);
  const i = order.indexOf(productId);
  if (i === -1) return;
  // up/down — מקום אחד; position — מספר 1..n שהוקלד (נחתך לטווח)
  const j = direction === 'up' ? i - 1 : direction === 'down' ? i + 1 : Number.isFinite(position) ? position - 1 : i;
  const target = Math.max(0, Math.min(j, order.length - 1));
  if (target === i) return;
  order.splice(i, 1);
  order.splice(target, 0, productId);
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

/** הצגה/הסתרה של מוצר בחנות ישירות מדף הקטגוריה. */
export async function toggleProductActive(formData: FormData): Promise<void> {
  const categoryId = String(formData.get('categoryId') || '');
  const productId = String(formData.get('productId') || '');
  const { user, nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  await assertOwnedBy(prisma, 'nurseryProduct', productId, nurseryId);
  const product = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: productId }, select: { isActive: true } });
  const isActive = !product.isActive;
  await prisma.nurseryProduct.update({ where: { id: productId }, data: { isActive } });
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'product.update',
    entityType: 'NurseryProduct',
    entityId: productId,
    metadata: { isActiveBefore: !isActive, isActiveAfter: isActive },
  });
  if (categoryId) revalidatePath(`/admin/products/categories/${categoryId}`);
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${productId}`);
}
