import { cache } from 'react';
import { interleave } from '@/lib/interleave';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSynonymIndex } from '@/lib/synonyms';
import { catalogRevisionInclude, localizeProduct } from '@/lib/catalog-localize';
import { categoryAndDescendantIds } from '@/lib/category-tree';
import { parseLetter } from '@/lib/alphabet';
import { PLANT_FACETS } from '@/lib/plant-facets';
import { priceSummary } from '@/lib/variants';
import {
  buildCatalogView,
  parseSort,
  toIndexEntry,
  type CatalogFilterState,
  type CatalogSort,
  type CatalogView,
} from '@/lib/catalog-filter';

export const PAGE_SIZE = 12;

const withRefs = {
  plant: true,
  supply: true,
  // וריאנטים פעילים (§7.01) — מחיר "החל מ-", זמינות ובחירה בדף המוצר
  variants: { where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] },
  // §6: הגרסה המאושרת של הפריט המרכזי — מוחלת ע"י localizeProduct
  ...catalogRevisionInclude,
} satisfies Prisma.NurseryProductInclude;

export type CatalogProduct = Prisma.NurseryProductGetPayload<{ include: typeof withRefs }>;

// ---------- עץ קטגוריות לניווט ----------

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  children: CategoryNode[];
}

interface RawCategory {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

const getRawCategories = cache(async (nurseryId: string): Promise<RawCategory[]> =>
  prisma.nurseryCategory.findMany({
    where: { nurseryId },
    select: { id: true, slug: true, name: true, parentId: true, sortOrder: true },
  }),
);

/**
 * עץ הקטגוריות של המשתלה — רק קטגוריות שיש בהן (או בצאצאיהן) מוצר פעיל.
 * משמש גם לתפריט הראשי וגם לסינון בקטלוג.
 */
export const getCategoryNav = cache(async (nurseryId: string): Promise<CategoryNode[]> => {
  const [categories, used] = await Promise.all([
    getRawCategories(nurseryId),
    prisma.nurseryProductCategory.findMany({
      where: { nurseryProduct: { nurseryId, isActive: true } },
      select: { nurseryCategoryId: true },
      distinct: ['nurseryCategoryId'],
    }),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const visible = new Set<string>();
  for (const { nurseryCategoryId } of used) {
    let current: string | null = nurseryCategoryId;
    while (current && byId.has(current) && !visible.has(current)) {
      visible.add(current);
      current = byId.get(current)!.parentId;
    }
  }

  const childrenOf = new Map<string | null, RawCategory[]>();
  for (const c of categories) {
    if (!visible.has(c.id)) continue;
    const parent = c.parentId && byId.has(c.parentId) ? c.parentId : null;
    const list = childrenOf.get(parent) ?? [];
    list.push(c);
    childrenOf.set(parent, list);
  }
  const build = (parent: string | null): CategoryNode[] =>
    (childrenOf.get(parent) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'he'))
      .map((c) => ({ id: c.id, slug: c.slug, name: c.name, children: build(c.id) }));
  return build(null);
});

/** הנתיב (שורש → הקטגוריה) לקטגוריה לפי slug או מזהה, או מערך ריק. */
export function findCategoryPath(nav: CategoryNode[], param: string | undefined): CategoryNode[] {
  if (!param) return [];
  const walk = (nodes: CategoryNode[], trail: CategoryNode[]): CategoryNode[] | null => {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.slug === param || node.id === param) return next;
      const found = walk(node.children, next);
      if (found) return found;
    }
    return null;
  };
  return walk(nav, []) ?? [];
}

// ---------- אינדקס הקטלוג ----------

/** כל המוצרים הפעילים של המשתלה בשדות מינימליים — בסיס לסינון ולספירות. */
const getCatalogIndex = cache(async (nurseryId: string) => {
  const rows = await prisma.nurseryProduct.findMany({
    where: { nurseryId, isActive: true },
    select: {
      id: true,
      createdAt: true,
      customTitle: true,
      price: true,
      compareAtPrice: true,
      variants: { where: { isActive: true } },
      plant: {
        select: {
          hebrewName: true,
          latinName: true,
          nickname: true,
          plantType: true,
          light: true,
          water: true,
          floweringSeason: true,
          flowerColor: true,
          growthRate: true,
          evergreen: true,
          coastal: true,
          native: true,
        },
      },
      supply: { select: { title: true } },
      categories: { select: { nurseryCategoryId: true, sortOrder: true } },
      catalogOverrides: true,
      ...catalogRevisionInclude,
    },
  });

  return rows.map(localizeProduct).map((r) =>
    toIndexEntry({
      id: r.id,
      createdAt: r.createdAt,
      price: priceSummary(r.variants, r).min,
      title: r.customTitle || r.plant?.hebrewName || r.supply?.title || 'מוצר ללא שם',
      altNames: [r.plant?.hebrewName, r.plant?.latinName, r.plant?.nickname],
      plant: r.plant,
      categorySort: Object.fromEntries(r.categories.map((c) => [c.nurseryCategoryId, c.sortOrder])),
    }),
  );
});

export type CatalogSearchParams = Record<string, string | undefined>;

/** קריאת פרמטרי הפאסטים מה-URL (מתעלם מערכים לא מוכרים). */
export function parseFacetParams(sp: CatalogSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of PLANT_FACETS) {
    const raw = sp[def.key]?.trim();
    if (!raw) continue;
    if (def.mode === 'exact' || def.buckets?.some((b) => b.key === raw)) out[def.key] = raw;
  }
  return out;
}

export interface CatalogPage extends CatalogView {
  items: CatalogProduct[];
  categoryPath: CategoryNode[];
  categoryNav: CategoryNode[];
  letter: string | null;
  sort: CatalogSort;
}

/** עמוד קטלוג מסונן של משתלה: מוצרים, ספירות, אותיות זמינות, פאסטים וקטגוריות. */
export async function getCatalogPage(
  nurseryId: string,
  sp: CatalogSearchParams,
): Promise<CatalogPage> {
  const [index, categoryNav, rawCategories, synonyms] = await Promise.all([
    getCatalogIndex(nurseryId),
    getCategoryNav(nurseryId),
    getRawCategories(nurseryId),
    sp.q?.trim() ? getSynonymIndex() : undefined,
  ]);

  const categoryPath = findCategoryPath(categoryNav, sp.category);
  const selected = categoryPath[categoryPath.length - 1];
  const letter = parseLetter(sp.letter);

  const sort = parseSort(sp.sort);
  const state: CatalogFilterState = {
    sort,
    q: sp.q,
    letter,
    categoryIds: selected ? categoryAndDescendantIds(rawCategories, selected.id) : null,
    facets: parseFacetParams(sp),
    synonyms,
  };

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const view = buildCatalogView(index, state, page, PAGE_SIZE);

  const found = view.pageIds.length
    ? await prisma.nurseryProduct.findMany({
        where: { id: { in: view.pageIds } },
        include: withRefs,
      })
    : [];
  const byId = new Map(found.map((p) => [p.id, localizeProduct(p)]));

  return {
    ...view,
    items: view.pageIds.map((id) => byId.get(id)).filter((p): p is CatalogProduct => Boolean(p)),
    categoryPath,
    categoryNav,
    letter,
    sort,
  };
}

export async function getFeaturedProducts(nurseryId: string, take = 8) {
  const rows = await prisma.nurseryProduct.findMany({
    where: { nurseryId, isActive: true },
    include: withRefs,
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map(localizeProduct);
}

export async function getProductById(nurseryId: string, id: string) {
  const p = await prisma.nurseryProduct.findFirst({
    where: { id, nurseryId, isActive: true },
    include: withRefs,
  });
  return p ? localizeProduct(p) : null;
}

/** שם הקטגוריה לתצוגה בכרטיס (הקטגוריה הספציפית ביותר של המוצר). רק קטגוריות של המשתלה. */
export async function getProductCategoryLabels(nurseryId: string, productIds: string[]): Promise<Record<string, string>> {
  if (productIds.length === 0) return {};
  const [rows, all] = await Promise.all([
    prisma.nurseryProductCategory.findMany({
      where: { nurseryProductId: { in: productIds }, nurseryCategory: { nurseryId } },
      select: { nurseryProductId: true, nurseryCategoryId: true },
    }),
    getRawCategories(nurseryId),
  ]);
  const byId = new Map(all.map((c) => [c.id, c]));
  const depth = (id: string) => {
    let d = 0;
    for (let c = byId.get(id); c?.parentId && d < 10; c = byId.get(c.parentId)) d++;
    return d;
  };
  const out: Record<string, { name: string; depth: number }> = {};
  for (const r of rows) {
    const c = byId.get(r.nurseryCategoryId);
    if (!c) continue;
    const d = depth(c.id);
    if (!out[r.nurseryProductId] || d > out[r.nurseryProductId]!.depth) out[r.nurseryProductId] = { name: c.name, depth: d };
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.name]));
}

/**
 * R03-06: מוצרים לבלוק בעמוד — ידני (בסדר שנבחר), חדשים, במבצע, לפי קטגוריה (כולל תתי־קטגוריות)
 * או מגוון (mixed): מכל קטגוריה ראשית לסירוגין, כך שהבלוק מציג מוצרים מקטגוריות שונות.
 */
export async function getBlockProducts(
  nurseryId: string,
  src: { source: 'manual' | 'newest' | 'sale' | 'category' | 'mixed'; productIds: string[]; categoryId: string; limit: number },
): Promise<CatalogProduct[]> {
  const base = { nurseryId, isActive: true } satisfies Prisma.NurseryProductWhereInput;
  if (src.source === 'mixed') {
    const raw = await getRawCategories(nurseryId);
    const roots = raw.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'he'));
    if (roots.length === 0) return getFeaturedProducts(nurseryId, src.limit);
    const lists = await Promise.all(
      roots.map((r) =>
        prisma.nurseryProduct.findMany({
          where: { ...base, categories: { some: { nurseryCategoryId: { in: categoryAndDescendantIds(raw, r.id) } } } },
          include: withRefs,
          orderBy: { createdAt: 'desc' },
          take: src.limit,
        }),
      ),
    );
    return interleave(lists, src.limit).map(localizeProduct);
  }
  if (src.source === 'manual') {
    if (src.productIds.length === 0) return [];
    const rows = await prisma.nurseryProduct.findMany({ where: { ...base, id: { in: src.productIds } }, include: withRefs });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return src.productIds.flatMap((id) => (byId.has(id) ? [localizeProduct(byId.get(id)!)] : [])).slice(0, src.limit);
  }
  if (src.source === 'category') {
    const ids = categoryAndDescendantIds(await getRawCategories(nurseryId), src.categoryId);
    if (ids.length === 0) return [];
    const rows = await prisma.nurseryProduct.findMany({
      where: { ...base, categories: { some: { nurseryCategoryId: { in: ids } } } },
      include: withRefs,
      orderBy: { createdAt: 'desc' },
      take: src.limit,
    });
    return rows.map(localizeProduct);
  }
  if (src.source === 'sale') {
    // "במבצע" = מחיר לפני הנחה גבוה מהמחיר (במוצר או בווריאנט) — מחושב כמו בכרטיס המוצר
    const rows = await prisma.nurseryProduct.findMany({
      where: { ...base, OR: [{ compareAtPrice: { not: null } }, { variants: { some: { isActive: true, compareAtPrice: { not: null } } } }] },
      include: withRefs,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows
      .filter((r) => priceSummary(r.variants, r).compareAt !== null)
      .slice(0, src.limit)
      .map(localizeProduct);
  }
  return getFeaturedProducts(nurseryId, src.limit);
}
