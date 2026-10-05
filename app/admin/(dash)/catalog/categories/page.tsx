import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';
import { CategoryForm } from './forms';
import { deleteCategory } from './actions';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  await requireUser(['SUPER_ADMIN']);

  const categories = await prisma.plantCategory.findMany({
    include: { _count: { select: { plants: true } } },
  });
  const tree = flattenCategoryTree(categories);
  const countById = new Map(categories.map((c) => [c.id, c._count.plants]));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">קטגוריות צמחים</h1>
        <p className="text-sm text-gray-500">
          עץ קטגוריות ברמת הקטלוג המרכזי: קטגוריה ראשית ותתי-קטגוריות. שיוך צמח לתת-קטגוריה לא
          משייך אותו אוטומטית להורה — סמנו את שניהם אם רוצים שיופיע בשניהם.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <CategoryForm options={tree} />
      </div>

      {tree.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {tree.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0"
              style={{ paddingInlineStart: `${1 + c.depth * 1.5}rem` }}
            >
              <span className={c.depth === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}>
                {c.depth > 0 && <span className="ml-1 text-gray-300">↳</span>}
                {c.name}
              </span>
              <span className="text-sm text-gray-500">{countById.get(c.id) ?? 0} צמחים</span>
              <form action={deleteCategory} className="ms-auto">
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
