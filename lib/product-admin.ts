import type { PrismaClient } from '@prisma/client';
import { resolveProductContent } from '@/lib/seo';
import { catalogRevisionInclude, localizeProduct } from '@/lib/catalog-localize';

/**
 * מחיקה ושכפול של מוצר משתלה. מקבל את ה-DB כפרמטר (בר-בדיקה).
 *
 * מחיקה (החלטת בעלים): מוצר בלי הזמנות נמחק לגמרי. מוצר שהוזמן נעלם מהמלאי ומהחנות, וההזמנות נשארות
 * שלמות. הקישור לקטלוג והכתובת משתחררים, כדי שאפשר יהיה לשייך את אותו צמח מחדש.
 */
export async function removeProduct(db: PrismaClient, nurseryId: string, productId: string): Promise<{ ok: boolean; mode?: 'deleted' | 'archived'; title?: string }> {
  const p = await db.nurseryProduct.findFirst({
    where: { id: productId, nurseryId, deletedAt: null },
    include: { plant: true, supply: true, _count: { select: { orderItems: true } } },
  });
  if (!p) return { ok: false };
  const { title } = resolveProductContent(p);

  if (p._count.orderItems === 0) {
    await db.nurseryProduct.delete({ where: { id: p.id } });
    return { ok: true, mode: 'deleted', title };
  }
  await db.$transaction([
    db.nurseryProductCategory.deleteMany({ where: { nurseryProductId: p.id } }),
    db.customerFavorite.deleteMany({ where: { nurseryProductId: p.id } }),
    db.nurseryProduct.update({
      where: { id: p.id },
      data: { deletedAt: new Date(), isActive: false, customTitle: title, plantId: null, supplyId: null, slug: null, customImageUrl: null, imageRequired: false, catalogRevisionId: null },
    }),
  ]);
  return { ok: true, mode: 'archived', title };
}

/**
 * שכפול: מוצר חדש ועצמאי, מוסתר ובלי מלאי עד שבעל המשתלה עובר עליו. צמח מהקטלוג יכול להופיע פעם אחת
 * בכל משתלה, ולכן העותק הוא מוצר מותאם עם התוכן של המקור, ולא מקבל עדכונים מהקטלוג.
 */
export async function duplicateProduct(db: PrismaClient, nurseryId: string, productId: string): Promise<{ ok: true; id: string; title: string } | { ok: false }> {
  const found = await db.nurseryProduct.findFirst({
    where: { id: productId, nurseryId, deletedAt: null },
    include: { plant: true, supply: true, categories: true, variants: { orderBy: { sortOrder: 'asc' } }, ...catalogRevisionInclude },
  });
  if (!found) return { ok: false };
  const p = localizeProduct(found);
  const { title, description, image } = resolveProductContent(p);
  const copyTitle = `${title} (עותק)`;

  const copyId = await db.$transaction(async (tx) => {
    const copy = await tx.nurseryProduct.create({
      data: {
        nurseryId,
        customTitle: copyTitle,
        customDescription: description || null,
        customImageUrl: image,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        stockQuantity: 0,
        isActive: false,
        alwaysInStock: p.alwaysInStock,
        seoMetaTitle: p.seoMetaTitle,
        seoMetaDescription: p.seoMetaDescription,
        optionLabel: p.optionLabel,
        option2Label: p.option2Label,
        categories: { create: found.categories.map((c) => ({ nurseryCategoryId: c.nurseryCategoryId })) },
      },
    });
    // trigger ב-DB יוצר וריאנט ברירת מחדל לכל מוצר חדש: מעדכנים אותו, ומוסיפים את השאר.
    // בלי מלאי, ובלי מק"ט וברקוד שהם ייחודיים במשתלה
    for (const v of found.variants) {
      const data = {
        name: v.name,
        option1: v.option1,
        option2: v.option2,
        colorHex: v.colorHex,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        imageUrls: v.imageUrls,
        isActive: v.isActive,
        sortOrder: v.sortOrder,
      };
      if (v.isDefault) await tx.productVariant.updateMany({ where: { nurseryProductId: copy.id, isDefault: true }, data });
      else await tx.productVariant.create({ data: { ...data, nurseryId, nurseryProductId: copy.id, isDefault: false } });
    }
    return copy.id;
  });
  return { ok: true, id: copyId, title: copyTitle };
}
