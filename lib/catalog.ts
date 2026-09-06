import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
  page?: number;
}

/** Paginated, filterable catalog query for a single tenant. */
export async function getCatalog({ nurseryId, q, plantType, page = 1 }: CatalogQuery) {
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
