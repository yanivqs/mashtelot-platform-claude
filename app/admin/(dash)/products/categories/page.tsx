import Link from 'next/link';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';
import { NurseryCategoryForm } from './forms';
import { deleteNurseryCategory, moveNurseryCategory } from './actions';
import { PositionInput } from '@/components/admin/position-input';

export const dynamic = 'force-dynamic';

export default async function NurseryCategoriesPage() {
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });

  const categories = await prisma.nurseryCategory.findMany({
    where: { nurseryId },
    include: { _count: { select: { products: true } } },
  });
  const tree = flattenCategoryTree(categories);
  const countById = new Map(categories.map((c) => [c.id, c._count.products]));
  // מיקום כל קטגוריה בין אחיותיה (אותו אב) — לפי סדר העץ
  const ids = new Set(categories.map((c) => c.id));
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId && ids.has(c.parentId) ? c.parentId : null]));
  const siblingsOf = new Map<string | null, string[]>();
  for (const c of tree) {
    const list = siblingsOf.get(parentOf.get(c.id) ?? null) ?? [];
    list.push(c.id);
    siblingsOf.set(parentOf.get(c.id) ?? null, list);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה למלאי
      </Link>

      <div>
        <h1 className="text-2xl font-bold">הקטגוריות שלי</h1>
        <p className="text-sm text-gray-500">
          סדרו את המוצרים בחנות שלכם לפי הקטגוריות שמתאימות לכם — קטגוריות ותתי-קטגוריות. הן
          מופיעות בסינון בחנות ומשויכות למוצרים מתוך עריכת המוצר. החיצים והמספר קובעים את סדר
          התצוגה בתפריט ובקטלוג — תת-קטגוריה מסודרת בין האחיות שלה.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <NurseryCategoryForm options={tree} />
      </div>

      {tree.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
          עדיין אין קטגוריות משלכם.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {tree.map((c) => {
            const siblings = siblingsOf.get(parentOf.get(c.id) ?? null) ?? [c.id];
            const index = siblings.indexOf(c.id);
            return (
            <div
              key={c.id}
              className="flex items-center gap-2 border-b border-gray-50 px-3 py-2.5 last:border-0 sm:gap-4 sm:px-4"
              style={{ paddingInlineStart: `${0.75 + c.depth * 1.5}rem` }}
            >
              <div className="flex shrink-0 items-center gap-0.5">
                <PositionInput key={`${c.id}-${index}`} action={moveNurseryCategory} position={index + 1} max={siblings.length} label={`מיקום ${c.name}`}>
                  <input type="hidden" name="id" value={c.id} />
                </PositionInput>
                <form action={moveNurseryCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button disabled={index === 0} aria-label={`העלאת ${c.name}`} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </form>
                <form action={moveNurseryCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button disabled={index === siblings.length - 1} aria-label={`הורדת ${c.name}`} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </form>
              </div>
              <Link
                href={`/admin/products/categories/${c.id}`}
                className={`min-w-0 flex-1 truncate hover:text-brand-700 hover:underline ${c.depth === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}
              >
                {c.depth > 0 && <span className="ml-1 text-gray-300">↳</span>}
                {c.name}
              </Link>
              <span className="shrink-0 text-xs text-gray-500 sm:text-sm">{countById.get(c.id) ?? 0} מוצרים</span>
              <form action={deleteNurseryCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs text-red-600 hover:text-red-800">מחק</button>
              </form>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
