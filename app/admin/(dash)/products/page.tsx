import Link from 'next/link';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { resolveProductContent } from '@/lib/seo';
import { scoreProductSeo } from '@/lib/seo-score';
import { flattenCategoryTree } from '@/lib/category-tree';
import { firstLetter, parseLetter } from '@/lib/alphabet';
import { lettersOf } from '@/lib/letter-filter';
import { AlphabetBar } from '@/components/alphabet-bar';
import { ProductRow, type RowProduct } from './product-row';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage(
  props: {
    searchParams: Promise<{ q?: string; letter?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });


  const [products, nurseryCategories] = await Promise.all([
    prisma.nurseryProduct.findMany({
      where: { nurseryId },
      include: {
        plant: true,
        supply: true,
        categories: true,
        variants: { orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }] },
      },
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
      reservedQuantity: p.reservedQuantity,
      isActive: p.isActive,
      customTitle: p.customTitle,
      customDescription: p.customDescription,
      customImageUrl: p.customImageUrl,
      seoMetaTitle: p.seoMetaTitle,
      seoMetaDescription: p.seoMetaDescription,
      categoryIds: p.categories.map((c) => c.nurseryCategoryId),
      plant: p.plant,
      seo: scoreProductSeo(p),
      optionLabel: p.optionLabel,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price?.toString() ?? null,
        compareAtPrice: v.compareAtPrice?.toString() ?? null,
        stockQuantity: v.stockQuantity,
        reservedQuantity: v.reservedQuantity,
        imageUrls: v.imageUrls,
        isDefault: v.isDefault,
        isActive: v.isActive,
      })),
    };
  });

  const needsSeo = rows.filter((r) => r.seo.level !== 'good').length;

  // סינון לפי אות / חיפוש (בזיכרון — מלאי של משתלה בודדת)
  const q = searchParams.q?.trim().toLowerCase() || '';
  const letter = parseLetter(searchParams.letter);
  const letters = lettersOf(rows.map((r) => r.title));
  const visibleRows = rows.filter(
    (r) =>
      (!letter || firstLetter(r.title) === letter) &&
      (!q || `${r.title} ${r.latinName ?? ''}`.toLowerCase().includes(q)),
  );
  const letterHref = (l: string | null) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (l) sp.set('letter', l);
    const s = sp.toString();
    return s ? `/admin/products?${s}` : '/admin/products';
  };

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
        <>
          <div className="mb-4 space-y-3">
            <form method="get" className="flex max-w-lg gap-3">
              {letter && <input type="hidden" name="letter" value={letter} />}
              <input
                name="q"
                defaultValue={searchParams.q ?? ''}
                placeholder="חיפוש במלאי..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
                חיפוש
              </button>
            </form>
            <AlphabetBar available={letters} active={letter} hrefFor={letterHref} />
            {(letter || q) && (
              <p className="text-xs text-gray-500">
                מוצגים {visibleRows.length} מתוך {rows.length}
              </p>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {visibleRows.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">לא נמצאו מוצרים.</p>
            )}
            {visibleRows.map((product) => (
              <ProductRow key={product.id} product={product} categoryOptions={categoryOptions} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
