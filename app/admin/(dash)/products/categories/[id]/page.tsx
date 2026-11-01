import { catalogRevisionInclude, localizeProduct } from '@/lib/catalog-localize';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUp, ArrowDown, ExternalLink, X } from 'lucide-react';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { resolveProductContent, tenantOrigin } from '@/lib/seo';
import { productSlug } from '@/lib/utils';
import { adminProductViewUrl } from '@/lib/product-preview';
import { PositionInput } from '@/components/admin/position-input';
import { moveProductInCategory, removeProductFromCategory, toggleProductActive } from './actions';
import { AddProductsList } from './add-products';
import { EditCategoryForm } from '../forms';

export const dynamic = 'force-dynamic';

export default async function CategoryManagerPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });

  // קטגוריה של משתלה אחרת = לא נמצאה (אין חשיפת קיום)
  const category = await prisma.nurseryCategory.findFirst({ where: { id: params.id, nurseryId } });
  if (!category) notFound();

  const [allCategories, assignments, allProducts, nursery] = await Promise.all([
    prisma.nurseryCategory.findMany({ where: { nurseryId: category.nurseryId } }),
    prisma.nurseryProductCategory.findMany({
      where: { nurseryCategoryId: category.id },
      orderBy: [{ sortOrder: 'asc' }, { nurseryProductId: 'asc' }],
      include: { nurseryProduct: { include: { plant: true, supply: true, ...catalogRevisionInclude } } },
    }).then((rows) => rows.map((a) => ({ ...a, nurseryProduct: localizeProduct(a.nurseryProduct) }))),
    prisma.nurseryProduct.findMany({
      where: { nurseryId: category.nurseryId },
      include: { plant: true, supply: true, ...catalogRevisionInclude },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => rows.map(localizeProduct)),
    prisma.nursery.findUniqueOrThrow({ where: { id: category.nurseryId }, select: { subdomain: true, customDomain: true } }),
  ]);
  const origin = tenantOrigin(nursery);

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
          {assignments.length} מוצרים · הסדר כאן הוא הסדר שבו המוצרים מוצגים בחנות כשמסננים לפי קטגוריה. אפשר להקליד מספר מיקום ולהקיש Enter, או להשתמש בחיצים.
        </p>
      </div>

      <EditCategoryForm key={`${category.name}|${category.slug}`} id={category.id} name={category.name} slug={category.slug} />

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900">מוצרים בקטגוריה (לפי הסדר)</h2>
        {assignments.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
            אין מוצרים בקטגוריה עדיין. הוסיפו מוצרים מהרשימה למטה, או שייכו מוצר מעריכת המוצר.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {assignments.map((a, index) => {
              const p = a.nurseryProduct;
              const { title, image } = resolveProductContent(p);
              const visible = p.isActive && !p.imageRequired;
              const viewUrl = adminProductViewUrl(origin, { id: p.id, slug: productSlug(p.id, title, p.slug), visible });
              const ids = (
                <>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input type="hidden" name="productId" value={a.nurseryProductId} />
                </>
              );
              return (
                <div key={a.nurseryProductId} className="flex flex-wrap items-center gap-2 border-b border-gray-50 px-3 py-2.5 last:border-0 sm:flex-nowrap sm:gap-3 sm:px-4">
                  <PositionInput key={`${a.nurseryProductId}-${index}`} action={moveProductInCategory} position={index + 1} max={assignments.length} label={`מיקום ${title}`}>
                    {ids}
                  </PositionInput>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden>🪴</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${p.id}`} className="block truncate text-sm font-medium text-gray-900 hover:text-brand-700 hover:underline">
                      {title}
                    </Link>
                    {p.isActive && p.imageRequired && <p className="text-xs text-red-700">מוסתר עד שתועלה תמונה</p>}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <form action={toggleProductActive}>
                      {ids}
                      <button
                        aria-label={p.isActive ? `הסתרת ${title}` : `הצגת ${title}`}
                        title={p.isActive ? 'לחצו כדי להסתיר מהחנות' : 'לחצו כדי להציג בחנות'}
                        className={`me-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          visible ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p.isActive ? 'פעיל' : 'מוסתר'}
                      </button>
                    </form>
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener"
                      aria-label={visible ? 'צפייה באתר' : 'תצוגה מקדימה'}
                      title={visible ? 'צפייה באתר' : 'תצוגה מקדימה (המוצר מוסתר)'}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <form action={moveProductInCategory}>
                      {ids}
                      <input type="hidden" name="direction" value="up" />
                      <button disabled={index === 0} aria-label="העלאה" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </form>
                    <form action={moveProductInCategory}>
                      {ids}
                      <input type="hidden" name="direction" value="down" />
                      <button disabled={index === assignments.length - 1} aria-label="הורדה" className="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </form>
                    <form action={removeProductFromCategory}>
                      {ids}
                      <button aria-label="הסרה מהקטגוריה" className="rounded p-1.5 text-red-500 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {available.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-900">הוספת מוצר לקטגוריה</h2>
          <AddProductsList
            categoryId={category.id}
            products={available.map((p) => ({ id: p.id, title: resolveProductContent(p).title, kind: p.plantId ? 'צמח' : p.supplyId ? 'ציוד' : 'מוצר' }))}
          />
        </section>
      )}
    </div>
  );
}
