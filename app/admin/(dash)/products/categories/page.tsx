import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { requireAnyModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';
import { NurseryCategoryForm } from './forms';
import { deleteNurseryCategory } from './actions';

export const dynamic = 'force-dynamic';

export default async function NurseryCategoriesPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireAnyModule(['plant_catalog', 'supplies']);

  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);
  if (!nurseryId) return <p className="text-gray-500">אין משתלה משויכת.</p>;

  const categories = await prisma.nurseryCategory.findMany({
    where: { nurseryId },
    include: { _count: { select: { products: true } } },
  });
  const tree = flattenCategoryTree(categories);
  const countById = new Map(categories.map((c) => [c.id, c._count.products]));

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
          מופיעות בסינון בחנות ומשויכות למוצרים מתוך עריכת המוצר.
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
          {tree.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0"
              style={{ paddingInlineStart: `${1 + c.depth * 1.5}rem` }}
            >
              <Link
                href={`/admin/products/categories/${c.id}`}
                className={`hover:text-brand-700 hover:underline ${c.depth === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}`}
              >
                {c.depth > 0 && <span className="ml-1 text-gray-300">↳</span>}
                {c.name}
              </Link>
              <span className="text-sm text-gray-500">{countById.get(c.id) ?? 0} מוצרים</span>
              <form action={deleteNurseryCategory} className="ms-auto">
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs text-red-600 hover:text-red-800">מחק</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
