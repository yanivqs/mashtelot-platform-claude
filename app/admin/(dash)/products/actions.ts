'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { assertOwnedBy } from '@/lib/ownership';
import { setOnHandStock } from '@/lib/order-service';
import { recordAudit } from '@/lib/audit';
import { saveRedirect } from '@/lib/redirects-admin';
import { rateLimit } from '@/lib/rate-limit';
import { suggestSlugWithAi } from '@/lib/ai-slug';
import { isReservedProductSlug, normalizeProductSlug, productSlug } from '@/lib/utils';

/** המוצר שייך למשתלת המשתמש המחובר (ללא עקיפה לסופר-אדמין — C-P1-01). */
async function ownedProduct(
  productId: string,
): Promise<{ nurseryId: string; actorEmail: string | null }> {
  const { user, nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  await assertOwnedBy(prisma, 'nurseryProduct', productId, nurseryId);
  return { nurseryId, actorEmail: user.email };
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
      select: { price: true, stockQuantity: true, slug: true, customTitle: true, plant: { select: { hebrewName: true } }, supply: { select: { title: true } } },
    });

    const price = toDecimalString(formData.get('price'));
    if (!price) return { error: 'מחיר לא תקין' };

    // כתובת המוצר: אותיות לועזיות, ספרות ומקפים; ייחודית במשתלה
    let slug = before?.slug ?? null;
    if (formData.has('slug')) {
      const raw = String(formData.get('slug') || '');
      slug = normalizeProductSlug(raw);
      if (raw.trim() && !slug) return { error: 'כתובת לא תקינה — אותיות באנגלית, ספרות ומקפים בלבד' };
      if (slug && isReservedProductSlug(slug)) return { error: 'הכתובת לא יכולה להיות מזהה — בחרו מילים' };
      if (slug && slug !== before?.slug) {
        const taken = await prisma.nurseryProduct.findFirst({ where: { nurseryId, slug, id: { not: id } }, select: { id: true } });
        if (taken) return { error: 'הכתובת כבר בשימוש במוצר אחר' };
      }
    }
    const customImageUrl = optionalUrl(formData.get('customImageUrl'));

    // מלאי ברמת המוצר רק כשיש וריאנט יחיד (השדה לא מוצג כשיש כמה — המלאי לכל וריאנט, §7.01)
    const stockField = formData.get('stockQuantity');
    let nextStock = before?.stockQuantity ?? 0;
    if (stockField !== null) {
      const stock = parseInt(String(stockField || '0'), 10);
      nextStock = Number.isFinite(stock) && stock >= 0 ? stock : 0;
      // דרך שירות המלאי — לא מתחת לכמות השמורה להזמנות, ונרשם כתנועת מלאי (C-P1-02)
      const stockRes = await setOnHandStock(prisma, { nurseryId, productId: id, quantity: nextStock, actorEmail });
      if (!stockRes.ok) return { error: stockRes.error };
    }

    await prisma.nurseryProduct.update({
      where: { id },
      data: {
        price,
        compareAtPrice: toDecimalString(formData.get('compareAtPrice')),
        isActive: formData.get('isActive') === 'on',
        alwaysInStock: formData.get('alwaysInStock') === 'on',
        customTitle: (String(formData.get('customTitle') || '').trim() || null),
        customDescription: (String(formData.get('customDescription') || '').trim() || null),
        customImageUrl,
        slug,
        // הועלתה תמונה משלכם — המוצר כבר לא ממתין לתמונה
        ...(customImageUrl ? { imageRequired: false } : {}),
        seoMetaTitle: (String(formData.get('seoMetaTitle') || '').trim() || null),
        seoMetaDescription: (String(formData.get('seoMetaDescription') || '').trim() || null),
        ...(formData.has('optionLabel')
          ? { optionLabel: String(formData.get('optionLabel') || '').trim().slice(0, 40) || null }
          : {}),
        ...(formData.has('option2Label')
          ? { option2Label: String(formData.get('option2Label') || '').trim().slice(0, 40) || null }
          : {}),
      },
    });

    await syncProductCategories(id, nurseryId, formData.getAll('categoryIds').map(String));

    // הכתובת השמורה הקודמת ממשיכה לעבוד — הפניה קבועה לכתובת החדשה
    if (before?.slug && before.slug !== slug) {
      const title = String(formData.get('customTitle') || '').trim() || before.customTitle || before.plant?.hebrewName || before.supply?.title || 'מוצר';
      const res = await saveRedirect(prisma, nurseryId, `/product/${before.slug}`, `/product/${productSlug(id, title, slug)}`);
      if (!res.ok) console.warn('[products] הפניה מהכתובת הקודמת לא נשמרה', res.error);
    }

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
    revalidatePath(`/admin/products/${id}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'שגיאה בעדכון' };
  }
}

export type SuggestSlugState = { slug?: string; error?: string };

/** הצעת כתובת באנגלית עם AI (נספר לחיוב — lib/ai-slug.ts). */
export async function suggestProductSlug(productId: string, title: string): Promise<SuggestSlugState> {
  const { nurseryId, actorEmail } = await ownedProduct(productId);
  const rl = await rateLimit(`ai-slug:${nurseryId}`, 30, 60 * 60 * 1000);
  if (!rl.ok) return { error: 'הגעתם למגבלת ההצעות לשעה — נסו שוב מאוחר יותר' };
  const p = await prisma.nurseryProduct.findUnique({
    where: { id: productId },
    select: { plantId: true, supplyId: true, plant: { select: { latinName: true } } },
  });
  return suggestSlugWithAi({
    nurseryId,
    actorEmail,
    title: String(title || '').trim().slice(0, 120) || 'מוצר',
    latinName: p?.plant?.latinName ?? null,
    kind: p?.plantId ? 'plant' : p?.supplyId ? 'garden supply' : null,
  });
}

export async function createCustomProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const { nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });

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
      alwaysInStock: formData.get('alwaysInStock') === 'on',
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
  redirect('/admin/products');
}

/** "תמיד במלאי" ישירות מרשימת המלאי — זמין למכירה בלי קשר לכמות. */
export async function toggleAlwaysInStock(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '');
  const { nurseryId, actorEmail } = await ownedProduct(id);
  const p = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id }, select: { alwaysInStock: true } });
  const alwaysInStock = !p.alwaysInStock;
  await prisma.nurseryProduct.update({ where: { id }, data: { alwaysInStock } });
  await recordAudit({
    nurseryId,
    actorEmail,
    action: 'product.update',
    entityType: 'NurseryProduct',
    entityId: id,
    metadata: { alwaysInStockBefore: !alwaysInStock, alwaysInStockAfter: alwaysInStock },
  });
  revalidatePath('/admin/products');
  revalidatePath(`/admin/products/${id}`);
}
