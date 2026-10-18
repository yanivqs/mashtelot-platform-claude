import 'server-only';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/module-access';
import { getCategoryNav, type CategoryNode } from '@/lib/catalog';
import { productSlug } from '@/lib/utils';
import type { SitemapEntry } from '@/lib/seo-files';

/**
 * רשומות ה-sitemap של משתלה — רק מה שהחנות באמת מגישה לציבור, באותם כללי מודולים:
 * בית, קטלוג, צור קשר, קטגוריות עם מוצרים, מוצרים פעילים, עמודים מפורסמים (static_pages)
 * ופוסטים מפורסמים (blog). מסננים/חיפוש/אותיות אינם נכללים (noindex) — C-P1-05.
 */
export async function nurserySitemapEntries(nurseryId: string): Promise<SitemapEntry[]> {
  const [products, categories, pagesOn, blogOn] = await Promise.all([
    prisma.nurseryProduct.findMany({
      where: { nurseryId, isActive: true },
      select: {
        id: true,
        updatedAt: true,
        customTitle: true,
        plant: { select: { hebrewName: true } },
        supply: { select: { title: true } },
      },
    }),
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

  const entries: SitemapEntry[] = [
    { path: '/', priority: 1 },
    { path: '/catalog', priority: 0.9 },
    { path: '/contact', priority: 0.5 },
    ...flatCategories.map((c) => ({ path: `/catalog?category=${c.slug}`, priority: 0.8 })),
    ...products.map((p) => ({
      path: `/product/${productSlug(p.id, p.customTitle || p.plant?.hebrewName || p.supply?.title || 'מוצר')}`,
      lastModified: p.updatedAt,
      priority: 0.7,
    })),
    ...pages.map((p) => ({ path: `/${p.slug}`, lastModified: p.updatedAt, priority: 0.5 })),
  ];
  if (blogOn) {
    entries.push({ path: '/blog', priority: 0.6 });
    entries.push(...posts.map((p) => ({ path: `/blog/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })));
  }
  return entries;
}
