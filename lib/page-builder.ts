import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/module-access';
import { getBlockProducts, getCategoryNav, getProductCategoryLabels, type CatalogProduct, type CategoryNode } from '@/lib/catalog';
import { liveBlocks } from '@/lib/page-builder-admin';
import type { Block } from '@/lib/page-blocks';

/**
 * R03 Page Builder — צד החנות: הבלוקים החיים ליעד (דף הבית / עמוד סטטי) ונתוני הבלוקים.
 * המודול כבוי, הפריסה כבויה או אין גרסה שפורסמה → null, והחנות מציגה את התצוגה הרגילה.
 */
export const getLiveLayout = cache(async (nurseryId: string, key: string): Promise<Block[] | null> => {
  if (!(await isModuleEnabled(nurseryId, 'page_builder'))) return null;
  return liveBlocks(prisma, nurseryId, key);
});

export interface ContentCardData {
  imageUrl: string;
  title: string;
  text: string;
  href: string;
}

export interface BlockData {
  products: Record<string, CatalogProduct[]>;
  categories: Record<string, CategoryNode[]>;
  /** שם קטגוריה לכל מוצר — לבלוקים עם showCategory */
  productCategories: Record<string, string>;
  /** כרטיסי תוכן לכל בלוק contentCards (ידני, או הפוסטים האחרונים בבלוג) */
  cards: Record<string, ContentCardData[]>;
}

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** טוען את המוצרים והקטגוריות שהבלוקים צריכים (לפי מזהה בלוק). רק נתוני המשתלה הזו. */
export async function loadBlockData(nurseryId: string, blocks: Block[]): Promise<BlockData> {
  const data: BlockData = { products: {}, categories: {}, productCategories: {}, cards: {} };
  const nav = blocks.some((b) => b.type === 'categories') ? await getCategoryNav(nurseryId) : [];
  await Promise.all(
    blocks.map(async (b) => {
      if (b.type === 'products') data.products[b.id] = await getBlockProducts(nurseryId, b);
      if (b.type === 'contentCards') data.cards[b.id] = b.source === 'manual' ? b.cards : await latestPosts(nurseryId, b.limit);
      if (b.type === 'categories') {
        // ריק = הקטגוריות הראשיות; אחרת — הנבחרות (רק כאלה שיש בהן מוצרים פעילים), לפי הסדר שנשמר במסך הקטגוריות
        const selected = new Set(b.categoryIds);
        data.categories[b.id] = b.categoryIds.length ? flatten(nav).filter((c) => selected.has(c.id)) : nav;
      }
    }),
  );
  const labelled = blocks.flatMap((b) => (b.type === 'products' && b.showCategory ? (data.products[b.id] ?? []).map((p) => p.id) : []));
  data.productCategories = await getProductCategoryLabels(nurseryId, labelled);
  return data;
}

/** הפוסטים האחרונים שפורסמו בבלוג — רק כשמודול הבלוג פעיל. */
async function latestPosts(nurseryId: string, limit: number): Promise<ContentCardData[]> {
  if (!(await isModuleEnabled(nurseryId, 'blog'))) return [];
  const posts = await prisma.blogPost.findMany({
    where: { nurseryId, isPublished: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: { slug: true, title: true, excerpt: true, coverImageUrl: true },
  });
  return posts.map((p) => ({ imageUrl: p.coverImageUrl ?? '', title: p.title, text: p.excerpt ?? '', href: `/blog/${p.slug}` }));
}

