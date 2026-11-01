import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveProductContent } from '@/lib/seo';
import { scoreProductSeo } from '@/lib/seo-score';
import { productSlug } from '@/lib/utils';
import { catalogRevisionInclude, localizeProduct } from '@/lib/catalog-localize';
import type { RowProduct } from './product-row';

const productInclude = {
  plant: true,
  supply: true,
  categories: true,
  variants: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] },
  ...catalogRevisionInclude,
} satisfies Prisma.NurseryProductInclude;

/** מוצרי המשתלה בתצוגת האדמין (רשימת המלאי ודף העריכה). */
export async function loadAdminProducts(nurseryId: string, where: Prisma.NurseryProductWhereInput = {}): Promise<RowProduct[]> {
  const products = await prisma.nurseryProduct.findMany({
    where: { ...where, nurseryId },
    include: productInclude,
    orderBy: { createdAt: 'desc' },
  });

  return products.map(localizeProduct).map((p) => {
    const { title, image } = resolveProductContent(p);
    return {
      id: p.id,
      title,
      latinName: p.plant?.latinName ?? null,
      image,
      kind: p.plantId ? 'צמח' : p.supplyId ? 'ציוד' : 'מוצר מותאם',
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      stockQuantity: p.stockQuantity,
      reservedQuantity: p.reservedQuantity,
      isActive: p.isActive,
      alwaysInStock: p.alwaysInStock,
      customTitle: p.customTitle,
      customDescription: p.customDescription,
      customImageUrl: p.customImageUrl,
      seoMetaTitle: p.seoMetaTitle,
      seoMetaDescription: p.seoMetaDescription,
      slug: p.slug,
      autoSlug: productSlug(p.id, title),
      imageRequired: p.imageRequired,
      needsDescription: Boolean(p.plantId || p.supplyId) && !p.customDescription?.trim(),
      categoryIds: p.categories.map((c) => c.nurseryCategoryId),
      plant: p.plant,
      seo: scoreProductSeo(p),
      optionLabel: p.optionLabel,
      option2Label: p.option2Label,
      variants: p.variants.map((v) => ({
        id: v.id,
        // ערך הציר הראשון; וריאנטים ישנים (לפני שני הצירים) — השם
        name: v.option1 ?? (v.option2 ? '' : v.name),
        option2: v.option2,
        colorHex: v.colorHex,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price?.toString() ?? null,
        compareAtPrice: v.compareAtPrice?.toString() ?? null,
        stockQuantity: v.stockQuantity,
        reservedQuantity: v.reservedQuantity,
        imageUrls: v.imageUrls,
        isDefault: v.isDefault,
        isActive: v.isActive,
      })),
    };
  });
}
