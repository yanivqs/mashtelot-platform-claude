'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { deleteVariant, saveVariant } from '@/lib/variants-admin';
import type { VariantInput } from '@/lib/variants';

export interface VariantFormState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** הקלט שנשלח — נשמר בשגיאה (React 19 מאפס טפסים, UX-01) */
  values?: Record<string, string>;
}

function optionalNumber(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  return s ? Number(s) : null;
}

function readInput(formData: FormData): VariantInput {
  return {
    name: String(formData.get('name') || ''),
    option2: String(formData.get('option2') || '').trim() || null,
    // שדה color ריק כשלא סומן "דוגמית צבע"
    colorHex: formData.get('useColor') === 'on' ? String(formData.get('colorHex') || '') || null : null,
    sku: String(formData.get('sku') || '').trim() || null,
    barcode: String(formData.get('barcode') || '').trim() || null,
    price: optionalNumber(formData.get('price')),
    compareAtPrice: optionalNumber(formData.get('compareAtPrice')),
    stockQuantity: Number(String(formData.get('stockQuantity') || '0')),
    imageUrls: formData.getAll('imageUrls').map(String).filter(Boolean),
    isActive: formData.get('isActive') === 'on',
  };
}

const KEEP = ['name', 'option2', 'sku', 'barcode', 'price', 'compareAtPrice', 'stockQuantity'] as const;

export async function saveVariantAction(_prev: VariantFormState, formData: FormData): Promise<VariantFormState> {
  const { user, nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  const productId = String(formData.get('productId') || '');
  const variantId = String(formData.get('variantId') || '') || null;
  const input = readInput(formData);

  const res = await saveVariant(prisma, { nurseryId, productId, variantId, input, actorEmail: user.email });
  if (!res.ok) {
    return { error: res.error, values: Object.fromEntries(KEEP.map((k) => [k, String(formData.get(k) ?? '')])) };
  }
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: variantId ? 'variant.update' : 'variant.create',
    entityType: 'ProductVariant',
    entityId: res.variantId,
    metadata: { productId, name: input.name, price: input.price, stock: input.stockQuantity },
  });
  revalidatePath('/admin/products');
  return { ok: true, message: variantId ? 'נשמר ✓' : 'הווריאנט נוסף ✓' };
}

export async function deleteVariantAction(_prev: VariantFormState, formData: FormData): Promise<VariantFormState> {
  const { user, nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  const productId = String(formData.get('productId') || '');
  const variantId = String(formData.get('variantId') || '');

  const res = await deleteVariant(prisma, { nurseryId, productId, variantId });
  if (!res.ok) return { error: res.error };
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: res.deleted ? 'variant.delete' : 'variant.deactivate',
    entityType: 'ProductVariant',
    entityId: variantId,
    metadata: { productId },
  });
  revalidatePath('/admin/products');
  return {
    ok: true,
    message: res.deleted ? 'נמחק ✓' : 'לווריאנט יש היסטוריית הזמנות/מלאי — הוא הושבת ולא נמחק',
  };
}
