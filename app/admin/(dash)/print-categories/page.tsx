import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CategoryForm, DeleteCategoryForm } from './forms';

export const dynamic = 'force-dynamic';

/** קטגוריות בקטלוג בית הדפוס (מוצג למשתלות בלבד). שתי רמות: קטגוריה ותת-קטגוריה. */
export default async function PrintCategoriesPage() {
  await requireUser(['SUPER_ADMIN']);
  const cats = await prisma.printCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { templates: { select: { id: true, title: true }, orderBy: { sortOrder: 'asc' } } },
  });
  const roots = cats.filter((c) => !c.parentId);
  const parents = roots.map((c) => ({ id: c.id, name: c.name }));
  const ordered = roots.flatMap((r) => [r, ...cats.filter((c) => c.parentId === r.id)]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">קטגוריות דפוס</h1>
        <p className="mt-1 text-sm text-gray-500">
          הקטגוריות מסדרות את קטלוג בית הדפוס שהמשתלות רואות בניהול. משייכים מוצר לקטגוריה בדף המוצר ב
          <Link href="/admin/print-templates" className="text-brand-700 hover:underline">
            תבניות דפוס
          </Link>
          . קטגוריה בלי מוצרים זמינים לא מוצגת למשתלות.
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">קטגוריה חדשה</h2>
        <CategoryForm parents={parents} />
      </section>

      {ordered.map((c) => (
        <section key={c.id} className={`rounded-xl border border-gray-100 bg-white p-5 shadow-sm ${c.parentId ? 'mr-6 border-r-4 border-r-brand-200' : ''}`} data-testid={`print-category-${c.slug}`}>
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-bold">{c.name}</span>
              {c.parentId && <span className="text-xs text-gray-500">תת-קטגוריה</span>}
              {!c.isActive && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">מושבתת</span>}
              <span className="text-xs text-gray-500">
                {c.templates.length ? `מוצרים: ${c.templates.map((t) => t.title).join(', ')}` : 'אין מוצרים'}
              </span>
            </summary>
            <div className="mt-4 space-y-3">
              <CategoryForm value={{ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, imageUrl: c.imageUrl, sortOrder: c.sortOrder, isActive: c.isActive }} parents={parents} />
              <DeleteCategoryForm id={c.id} />
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
