import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CategoryForm } from './forms';
import { deleteCategory } from './actions';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  await requireUser(['SUPER_ADMIN']);

  const categories = await prisma.plantCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { plants: true } } },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">קטגוריות צמחים</h1>
        <p className="text-sm text-gray-500">
          קטגוריות ברמת הקטלוג המרכזי, לשיוך בעריכת צמח ולסינון בחנויות.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <CategoryForm />
      </div>

      {categories.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0"
            >
              <span className="font-medium text-gray-900">{c.name}</span>
              <span className="text-xs text-gray-400">{c.slug}</span>
              <span className="text-sm text-gray-500">{c._count.plants} צמחים</span>
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
