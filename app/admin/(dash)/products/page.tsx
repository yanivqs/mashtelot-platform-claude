import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { requireAnyModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { resolveProductContent } from '@/lib/seo';
import { scoreProductSeo } from '@/lib/seo-score';
import { flattenCategoryTree } from '@/lib/category-tree';
import { ProductRow, type RowProduct } from './product-row';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireAnyModule(['plant_catalog', 'supplies']);

  const nurseryId =
    user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : user.nurseryId;

  if (!nurseryId) {
    return <p className="text-gray-500">אין משתלה משויכת.</p>;
  }

  const [products, nurseryCategories] = await Promise.all([
    prisma.nurseryProduct.findMany({
      where: { nurseryId },
      include: { plant: true, supply: true, categories: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.nurseryCategory.findMany({ where: { nurseryId } }),
  ]);

  const categoryOptions = flattenCategoryTree(nurseryCategories);

  const rows: RowProduct[] = products.map((p) => {
    const { title, image } = resolveProductContent(p);
    return {
      id: p.id,
      title,
      latinName: p.plant?.latinName ?? null,
      image,
      kind: p.plantId ? 'צמח' : p.supplyId ? 'ציוד' : 'מוצר מותאם',
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      stockQuantity: p.stockQuantity,
      isActive: p.isActive,
      customTitle: p.customTitle,
      customDescription: p.customDescription,
      customImageUrl: p.customImageUrl,
      seoMetaTitle: p.seoMetaTitle,
      seoMetaDescription: p.seoMetaDescription,
      categoryIds: p.categories.map((c) => c.nurseryCategoryId),
      plant: p.plant,
      seo: scoreProductSeo(p),
    };
  });

  const needsSeo = rows.filter((r) => r.seo.level !== 'good').length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">המלאי שלי</h1>
          <p className="text-sm text-gray-500">
            {rows.length} מוצרים
            {needsSeo > 0 && (
              <span className="text-amber-700"> · {needsSeo} זקוקים לשיפור SEO</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/products/categories"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            הקטגוריות שלי
          </Link>
          <Link
            href="/admin/products/browse"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            שיוך מוצרים מהקטלוג
          </Link>
          <Link
            href="/admin/products/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + מוצר חדש
          </Link>
        </div>
      </div>

      {needsSeo > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          לכל מוצר יש מדד SEO. מוצרים שמסתמכים על התמונה והתיאור המשותפים חשופים לתוכן כפול
          ולדירוג נמוך מול משתלות אחרות — פתחו מוצר והעלו תמונה וכתבו תיאור ייחודיים.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          עדיין אין מוצרים בחנות.{' '}
          <Link href="/admin/products/browse" className="font-medium text-brand-700 hover:underline">
            שייכו מוצרים מהקטלוג
          </Link>{' '}
          או{' '}
          <Link href="/admin/products/new" className="font-medium text-brand-700 hover:underline">
            צרו מוצר חדש
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {rows.map((product) => (
            <ProductRow key={product.id} product={product} categoryOptions={categoryOptions} />
          ))}
        </div>
      )}
    </div>
  );
}
