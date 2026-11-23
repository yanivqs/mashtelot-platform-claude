'use server';

import { revalidatePath } from 'next/cache';
import { refreshStore } from '@/lib/store-refresh';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { assignPlantCategoriesToProduct } from '@/lib/category-provision';
import { pullSupplies } from '@/lib/manufacturers-admin';

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
  if (kind === 'supply') {
    // ציוד: יצרן, קוד יצרן וברקוד מהקטלוג; מחיר שהוזן — או המחיר המומלץ
    const res = await pullSupplies(prisma, nurseryId, [refId]);
    createdId = res.created[0]?.id ?? null;
    if (createdId && price !== '0.00') await prisma.nurseryProduct.update({ where: { id: createdId }, data: { price, isActive: true } });
    revalidatePath('/admin/products/browse');
    revalidatePath('/admin/products');
    refreshStore();
    if (createdId) redirect(`/admin/products/${createdId}?new=1`);
    return;
  }
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
  refreshStore();
  // ממשיכים מיד להשלמת תמונה ותיאור
  if (createdId) redirect(`/admin/products/${createdId}?new=1`);
}

/** משיכה מרובה של מוצרי ציוד (לפי יצרן) — חוזר לאותו עמוד עם סיכום. */
export async function addSuppliesBulk(formData: FormData): Promise<void> {
  const { nurseryId } = await requireNurseryAction({ all: ['supplies'] });
  const ids = formData.getAll('supplyIds').map(String).filter(Boolean);
  const res = await pullSupplies(prisma, nurseryId, ids);
  revalidatePath('/admin/products/browse');
  revalidatePath('/admin/products');
  refreshStore();
  const back = String(formData.get('back') || '');
  const base = back.startsWith('/admin/products/browse') ? back : '/admin/products/browse?tab=supplies';
  const u = new URL(base, 'http://x');
  u.searchParams.set('added', String(res.created.length));
  if (res.skipped) u.searchParams.set('skipped', String(res.skipped));
  else u.searchParams.delete('skipped');
  if (res.barcodeConflicts) u.searchParams.set('barcodes', String(res.barcodeConflicts));
  else u.searchParams.delete('barcodes');
  redirect(`${u.pathname}${u.search}`);
}
