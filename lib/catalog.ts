import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree, categoryAndDescendantIds } from '@/lib/category-tree';

export const PAGE_SIZE = 12;

const withRefs = {
  plant: true,
  supply: true,
} satisfies Prisma.NurseryProductInclude;

export type CatalogProduct = Prisma.NurseryProductGetPayload<{ include: typeof withRefs }>;

export interface CatalogQuery {
  nurseryId: string;
  q?: string;
  plantType?: string;
  categoryId?: string;
  page?: number;
}

/** Paginated, filterable catalog query for a single tenant. */
export async function getCatalog({ nurseryId, q, plantType, categoryId, page = 1 }: CatalogQuery) {
  const where: Prisma.NurseryProductWhereInput = {
    nurseryId,
    isActive: true,
  };

  if (q && q.trim()) {
    const term = q.trim();
    where.OR = [
      { customTitle: { contains: term, mode: 'insensitive' } },
      { plant: { is: { hebrewName: { contains: term, mode: 'insensitive' } } } },
      { plant: { is: { latinName: { contains: term, mode: 'insensitive' } } } },
      { supply: { is: { title: { contains: term, mode: 'insensitive' } } } },
    ];
  }

  if (plantType && plantType !== 'all') {
    where.plant = { is: { plantType } };
  }

  if (categoryId && categoryId !== 'all') {
    // בקטגוריה נבחרת: הסדר נקבע על ידי בעל המשתלה (sortOrder של השיוך לקטגוריה)
    const tree = await prisma.nurseryCategory.findMany({
      where: { nurseryId },
      select: { id: true, parentId: true },
    });
    const ids = categoryAndDescendantIds(tree, categoryId);
    const assignments = await prisma.nurseryProductCategory.findMany({
      where: { nurseryCategoryId: { in: ids }, nurseryProduct: { nurseryId, isActive: true } },
      orderBy: { sortOrder: 'asc' },
      select: { nurseryProductId: true },
    });
    const orderedIds = [...new Set(assignments.map((a) => a.nurseryProductId))];
    const matching = new Set(
      (await prisma.nurseryProduct.findMany({ where: { ...where, id: { in: orderedIds } }, select: { id: true } }))
        .map((p) => p.id),
    );
    const allIds = orderedIds.filter((id) => matching.has(id));
    const pageIds = allIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const found = await prisma.nurseryProduct.findMany({
      where: { id: { in: pageIds } },
      include: withRefs,
    });
    const byId = new Map(found.map((p) => [p.id, p]));
    return {
      items: pageIds.map((id) => byId.get(id)!).filter(Boolean),
      total: allIds.length,
      page,
      pageCount: Math.max(1, Math.ceil(allIds.length / PAGE_SIZE)),
    };
  }

  const [items, total] = await Promise.all([
    prisma.nurseryProduct.findMany({
      where,
      include: withRefs,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.nurseryProduct.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Distinct plant types available in a tenant's active catalog (for filters). */
export async function getPlantTypes(nurseryId: string): Promise<string[]> {
  const rows = await prisma.nurseryProduct.findMany({
    where: { nurseryId, isActive: true, plant: { is: { plantType: { not: null } } } },
    select: { plantId: true, plant: { select: { plantType: true } } },
    distinct: ['plantId'],
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.plant?.plantType) set.add(r.plant.plantType);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'he'));
}

export interface CategoryOption {
  id: string;
  name: string;
}

/** קטגוריות המשתלה (העץ שלה, מוזח לפי עומק) לתפריט הסינון בחנות. */
export async function getCategories(nurseryId: string): Promise<CategoryOption[]> {
  const categories = await prisma.nurseryCategory.findMany({
    where: { nurseryId },
    select: { id: true, name: true, parentId: true, sortOrder: true },
  });
  const used = await prisma.nurseryProductCategory.findMany({
    where: { nurseryProduct: { nurseryId, isActive: true } },
    select: { nurseryCategoryId: true },
    distinct: ['nurseryCategoryId'],
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  // קטגוריה מוצגת רק אם יש בה מוצר פעיל, או אם יש בתת-העץ שלה מוצר פעיל
  const visible = new Set<string>();
  for (const { nurseryCategoryId } of used) {
    let current: string | null = nurseryCategoryId;
    while (current && byId.has(current) && !visible.has(current)) {
      visible.add(current);
      current = byId.get(current)!.parentId;
    }
  }
  return flattenCategoryTree(categories)
    .filter((c) => visible.has(c.id))
    .map((c) => ({ id: c.id, name: `${'  '.repeat(c.depth)}${c.name}` }));
}

export async function getFeaturedProducts(nurseryId: string, take = 8) {
  return prisma.nurseryProduct.findMany({
    where: { nurseryId, isActive: true },
    include: withRefs,
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function getProductById(nurseryId: string, id: string) {
  return prisma.nurseryProduct.findFirst({
    where: { id, nurseryId, isActive: true },
    include: withRefs,
  });
}
