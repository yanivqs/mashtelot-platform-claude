import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUp, ArrowDown, X } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { requireAnyModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { resolveProductContent } from '@/lib/seo';
import { moveProductInCategory, removeProductFromCategory, addProductToCategory } from './actions';

export const dynamic = 'force-dynamic';

export default async function CategoryManagerPage({ params }: { params: { id: string } }) {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireAnyModule(['plant_catalog', 'supplies']);

  const category = await prisma.nurseryCategory.findUnique({ where: { id: params.id } });
  if (!category) notFound();
  if (user.role !== 'SUPER_ADMIN' && category.nurseryId !== user.nurseryId) notFound();

  const [allCategories, assignments, allProducts] = await Promise.all([
    prisma.nurseryCategory.findMany({ where: { nurseryId: category.nurseryId } }),
    prisma.nurseryProductCategory.findMany({
      where: { nurseryCategoryId: category.id },
      orderBy: [{ sortOrder: 'asc' }, { nurseryProductId: 'asc' }],
      include: { nurseryProduct: { include: { plant: true, supply: true } } },
    }),
    prisma.nurseryProduct.findMany({
      where: { nurseryId: category.nurseryId },
      include: { plant: true, supply: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const byId = new Map(allCategories.map((c) => [c.id, c]));
  const path: string[] = [];
  for (let cur: string | null = category.id; cur; cur = byId.get(cur)?.parentId ?? null) {
    path.unshift(byId.get(cur)?.name ?? '');
  }

  const inCategory = new Set(assignments.map((a) => a.nurseryProductId));
  const available = allProducts.filter((p) => !inCategory.has(p.id));

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/admin/products/categories"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לעץ הקטגוריות
      </Link>

      <div>
        <p className="text-xs text-gray-400">{path.join(' › ')}</p>
        <h1 className="text-2xl font-bold">{category.name}</h1>
        <p className="text-sm text-gray-500">
          {assignments.length} מוצרים · הסדר כאן הוא הסדר שבו המוצרים מוצגים בחנות כשמסננים לפי קטגוריה.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900">מוצרים בקטגוריה (לפי הסדר)</h2>
        {assignments.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
            אין מוצרים בקטגוריה עדיין. הוסיפו מוצרים מהרשימה למטה, או שייכו מוצר מעריכת המוצר.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {assignments.map((a, index) => {
              const { title, image } = resolveProductContent(a.nurseryProduct);
              return (
                <div key={a.nurseryProductId} className="flex items-center gap-3 border-b border-gray-50 px-4 py-2.5 last:border-0">
                  <span className="w-6 text-center text-xs text-gray-400">{index + 1}</span>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden>🪴</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{title}</p>
                    {!a.nurseryProduct.isActive && <p className="text-xs text-gray-400">מוסתר בחנות</p>}
                  </div>
                  <form action={moveProductInCategory}>
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input type="hidden" name="productId" value={a.nurseryProductId} />
                    <input type="hidden" name="direction" value="up" />
                    <button disabled={index === 0} aria-label="העלאה" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={moveProductInCategory}>
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input type="hidden" name="productId" value={a.nurseryProductId} />
                    <input type="hidden" name="direction" value="down" />
                    <button disabled={index === assignments.length - 1} aria-label="הורדה" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </form>
                  <form action={removeProductFromCategory}>
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input type="hidden" name="productId" value={a.nurseryProductId} />
                    <button aria-label="הסרה מהקטגוריה" className="rounded p-1.5 text-red-500 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {available.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-900">הוספת מוצר לקטגוריה</h2>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {available.map((p) => {
              const { title } = resolveProductContent(p);
              return (
                <form key={p.id} action={addProductToCategory} className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-2 last:border-0">
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input type="hidden" name="productId" value={p.id} />
                  <span className="truncate text-sm text-gray-800">{title}</span>
                  <button className="shrink-0 rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">
                    הוספה
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
