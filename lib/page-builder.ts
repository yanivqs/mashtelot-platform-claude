import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { isModuleEnabled } from '@/lib/module-access';
import { getBlockProducts, getCategoryNav, type CatalogProduct, type CategoryNode } from '@/lib/catalog';
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

export interface BlockData {
  products: Record<string, CatalogProduct[]>;
  categories: Record<string, CategoryNode[]>;
}

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** טוען את המוצרים והקטגוריות שהבלוקים צריכים (לפי מזהה בלוק). רק נתוני המשתלה הזו. */
export async function loadBlockData(nurseryId: string, blocks: Block[]): Promise<BlockData> {
  const data: BlockData = { products: {}, categories: {} };
  const nav = blocks.some((b) => b.type === 'categories') ? await getCategoryNav(nurseryId) : [];
  await Promise.all(
    blocks.map(async (b) => {
      if (b.type === 'products') data.products[b.id] = await getBlockProducts(nurseryId, b);
      if (b.type === 'categories') {
        // ריק = הקטגוריות הראשיות; אחרת — הנבחרות בסדר שנבחר (רק כאלה שיש בהן מוצרים פעילים)
        const all = new Map(flatten(nav).map((c) => [c.id, c]));
        data.categories[b.id] = b.categoryIds.length ? b.categoryIds.flatMap((id) => (all.has(id) ? [all.get(id)!] : [])) : nav;
      }
    }),
  );
  return data;
}

