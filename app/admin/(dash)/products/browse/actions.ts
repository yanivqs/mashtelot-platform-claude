'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

async function resolveNurseryId(): Promise<string> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  if (user.nurseryId) return user.nurseryId;
  if (user.role === 'SUPER_ADMIN') {
    const first = await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } });
    if (first) return first.id;
  }
  throw new Error('אין משתלה משויכת');
}

export async function addCatalogItem(formData: FormData): Promise<void> {
  const nurseryId = await resolveNurseryId();
  const kind = String(formData.get('kind'));
  const refId = String(formData.get('refId') || '');
  const priceRaw = Number(String(formData.get('price') || ''));
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw.toFixed(2) : '0.00';

  if (!refId) return;

  try {
    await prisma.nurseryProduct.create({
      data: {
        nurseryId,
        price,
        stockQuantity: 0,
        isActive: price !== '0.00',
        ...(kind === 'supply' ? { supplyId: refId } : { plantId: refId }),
      },
    });
  } catch {
    // כנראה כבר קיים (unique constraint) - מתעלמים
  }

  revalidatePath('/admin/products/browse');
  revalidatePath('/admin/products');
}
