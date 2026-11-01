import 'server-only';
import { catalogRevisionInclude, localizeProduct } from '@/lib/catalog-localize';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/module-access';
import { getCategoryNav, type CategoryNode } from '@/lib/catalog';
import { productSlug } from '@/lib/utils';
import { STORE_VISIBLE } from '@/lib/product-visibility';
import type { SitemapEntry } from '@/lib/seo-files';

/**
 * רשומות ה-sitemap של משתלה — רק מה שהחנות באמת מגישה לציבור, באותם כללי מודולים:
 * בית, קטלוג, צור קשר, קטגוריות עם מוצרים, מוצרים פעילים, עמודים מפורסמים (static_pages)
 * ופוסטים מפורסמים (blog). מסננים/חיפוש/אותיות אינם נכללים (noindex) — C-P1-05.
 */
export async function nurserySitemapEntries(nurseryId: string): Promise<SitemapEntry[]> {
  const [nursery, categoryProducts, products, categories, pagesOn, blogOn] = await Promise.all([
    prisma.nursery.findUniqueOrThrow({ where: { id: nurseryId }, select: { updatedAt: true } }),
    prisma.nurseryProductCategory.findMany({
      where: { nurseryProduct: { nurseryId, ...STORE_VISIBLE } },
      select: { nurseryCategoryId: true, nurseryProduct: { select: { updatedAt: true } } },
    }),
    prisma.nurseryProduct.findMany({
      where: { nurseryId, ...STORE_VISIBLE },
      select: {
        id: true,
        updatedAt: true,
        customTitle: true,
        slug: true,
        plant: { select: { hebrewName: true } },
        supply: { select: { title: true } },
        catalogOverrides: true,
        ...catalogRevisionInclude,
      },
    }).then((rows) => rows.map(localizeProduct)),
    getCategoryNav(nurseryId),
    isModuleEnabled(nurseryId, 'static_pages'),
    isModuleEnabled(nurseryId, 'blog'),
  ]);

  const [pages, posts] = await Promise.all([
    pagesOn
      ? prisma.staticPage.findMany({ where: { nurseryId, isPublished: true }, select: { slug: true, updatedAt: true } })
      : Promise.resolve([]),
    blogOn
      ? prisma.blogPost.findMany({ where: { nurseryId, isPublished: true }, select: { slug: true, updatedAt: true } })
      : Promise.resolve([]),
  ]);

  const flatCategories: CategoryNode[] = [];
  const walk = (nodes: CategoryNode[]) => nodes.forEach((n) => (flatCategories.push(n), walk(n.children)));
  walk(categories);

  // lastmod: המוצר שעודכן אחרון בקטגוריה (כולל צאצאיה) או בכל החנות
  const newest = (dates: Date[]) => new Date(Math.max(0, ...dates.map((d) => d.getTime())));
  const ownUpdate = new Map<string, Date[]>();
  for (const c of categoryProducts) {
    ownUpdate.set(c.nurseryCategoryId, [...(ownUpdate.get(c.nurseryCategoryId) ?? []), c.nurseryProduct.updatedAt]);
  }
  const categoryUpdate = (n: CategoryNode): Date => newest([...(ownUpdate.get(n.id) ?? []), ...n.children.map(categoryUpdate)]);
  const catalogUpdate = newest(products.map((p) => p.updatedAt));
  const storeUpdate = newest([catalogUpdate, nursery.updatedAt]);

  const entries: SitemapEntry[] = [
    { path: '/', lastModified: storeUpdate, priority: 1 },
    { path: '/catalog', lastModified: catalogUpdate, priority: 0.9 },
    { path: '/contact', lastModified: nursery.updatedAt, priority: 0.5 },
    { path: '/accessibility', lastModified: new Date('2026-11-01T00:00:00.000Z'), priority: 0.2 },
    ...flatCategories.map((c) => ({ path: `/catalog?category=${c.slug}`, lastModified: categoryUpdate(c), priority: 0.8 })),
    ...products.map((p) => ({
      path: `/product/${productSlug(p.id, p.customTitle || p.plant?.hebrewName || p.supply?.title || 'מוצר', p.slug)}`,
      lastModified: p.updatedAt,
      priority: 0.7,
    })),
    ...pages.map((p) => ({ path: `/${p.slug}`, lastModified: p.updatedAt, priority: 0.5 })),
  ];
  if (blogOn) {
    entries.push({ path: '/blog', lastModified: posts.length ? newest(posts.map((p) => p.updatedAt)) : null, priority: 0.6 });
    entries.push(...posts.map((p) => ({ path: `/blog/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })));
  }
  return entries;
}
