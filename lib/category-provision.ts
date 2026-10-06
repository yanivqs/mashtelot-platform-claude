import 'server-only';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';

/**
 * מעתיק את עץ הקטגוריות המרכזי למשתלה (לפי slug, הורים לפני ילדים). רק קטגוריות
 * חסרות נוצרות, כך שהפעולה idempotent וניתנת להרצה חוזרת. משתלה שמחקה קטגוריה
 * ידנית תקבל אותה מחדש בהרצה הבאה — ולכן הפעולה מופעלת רק ביצירת משתלה וביצירת
 * קטגוריה מרכזית חדשה.
 */
export async function syncMasterCategoriesToNursery(nurseryId: string): Promise<void> {
  const master = await prisma.plantCategory.findMany({
    select: { id: true, name: true, slug: true, parentId: true, sortOrder: true },
  });
  const ordered = flattenCategoryTree(master);
  const masterById = new Map(master.map((m) => [m.id, m]));

  const existing = await prisma.nurseryCategory.findMany({
    where: { nurseryId },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(existing.map((c) => [c.slug, c.id]));

  for (const node of ordered) {
    const m = masterById.get(node.id)!;
    if (idBySlug.has(m.slug)) continue;
    const parentSlug = m.parentId ? masterById.get(m.parentId)?.slug : undefined;
    const parentId = parentSlug ? (idBySlug.get(parentSlug) ?? null) : null;
    const created = await prisma.nurseryCategory.create({
      data: { nurseryId, name: m.name, slug: m.slug, parentId, sortOrder: m.sortOrder },
    });
    idBySlug.set(m.slug, created.id);
  }
}

/** מוסיף את כל המשתלות קטגוריה מרכזית חדשה (או מסנכרן את כולן). */
export async function syncMasterCategoriesToAllNurseries(): Promise<void> {
  const nurseries = await prisma.nursery.findMany({ select: { id: true } });
  for (const n of nurseries) await syncMasterCategoriesToNursery(n.id);
}

/**
 * משייך למוצר של המשתלה את קטגוריות הצמח המרכזיות (לפי slug). לא מסיר שיוכים קיימים,
 * ולא מוסיף קטגוריה שכבר משויכת למוצר. מיקום חדש בסוף הקטגוריה.
 */
export async function assignPlantCategoriesToProduct(
  productId: string,
  nurseryId: string,
  plantId: string,
): Promise<void> {
  await syncMasterCategoriesToNursery(nurseryId);

  const plantCats = await prisma.plantCategoryAssignment.findMany({
    where: { plantId },
    select: { category: { select: { slug: true } } },
  });
  const slugs = plantCats.map((p) => p.category.slug);
  if (slugs.length === 0) return;

  const targets = await prisma.nurseryCategory.findMany({
    where: { nurseryId, slug: { in: slugs } },
    select: { id: true },
  });
  const already = await prisma.nurseryProductCategory.findMany({
    where: { nurseryProductId: productId },
    select: { nurseryCategoryId: true },
  });
  const alreadySet = new Set(already.map((a) => a.nurseryCategoryId));

  for (const t of targets) {
    if (alreadySet.has(t.id)) continue;
    const last = await prisma.nurseryProductCategory.findFirst({
      where: { nurseryCategoryId: t.id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    await prisma.nurseryProductCategory.create({
      data: {
        nurseryProductId: productId,
        nurseryCategoryId: t.id,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }
}
