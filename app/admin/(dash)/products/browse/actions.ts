'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { assignPlantCategoriesToProduct } from '@/lib/category-provision';

export async function addCatalogItem(formData: FormData): Promise<void> {
  const kind = String(formData.get('kind'));
  // צמח דורש את מודול קטלוג הצמחים, ציוד — את מודול הציוד (לא "אחד מהם")
  const { nurseryId } = await requireNurseryAction({
    all: [kind === 'supply' ? 'supplies' : 'plant_catalog'],
  });
  const refId = String(formData.get('refId') || '');
  const priceRaw = Number(String(formData.get('price') || ''));
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw.toFixed(2) : '0.00';

  if (!refId) return;

  let createdId: string | null = null;
  try {
    const product = await prisma.nurseryProduct.create({
      data: {
        nurseryId,
        price,
        stockQuantity: 0,
        isActive: price !== '0.00',
        // מוסתר מהחנות עד שבעל המשתלה מעלה תמונה משלו (תמונת הקטלוג משותפת לכל המשתלות)
        imageRequired: true,
        ...(kind === 'supply' ? { supplyId: refId } : { plantId: refId }),
      },
    });
    createdId = product.id;
    if (kind !== 'supply') await assignPlantCategoriesToProduct(product.id, nurseryId, refId);
  } catch {
    // כנראה כבר קיים (unique constraint) - מתעלמים
  }

  revalidatePath('/admin/products/browse');
  revalidatePath('/admin/products');
  // ממשיכים מיד להשלמת תמונה ותיאור
  if (createdId) redirect(`/admin/products/${createdId}?new=1`);
}
