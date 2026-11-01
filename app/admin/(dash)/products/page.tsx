import Link from 'next/link';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { categoryAndDescendantIds, flattenCategoryTree } from '@/lib/category-tree';
import { parseInventorySort, sortInventory, type InventorySortKey } from '@/lib/inventory-sort';
import { firstLetter, parseLetter } from '@/lib/alphabet';
import { lettersOf } from '@/lib/letter-filter';
import { AlphabetBar } from '@/components/alphabet-bar';
import { ProductRow } from './product-row';
import { loadAdminProducts } from './load';
import { tenantOrigin } from '@/lib/seo';
import { adminProductViewUrl } from '@/lib/product-preview';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage(
  props: {
    searchParams: Promise<{ q?: string; letter?: string; category?: string; sort?: string; dir?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });


  const [rows, nurseryCategories, nursery] = await Promise.all([
    loadAdminProducts(nurseryId),
    prisma.nurseryCategory.findMany({ where: { nurseryId } }),
    prisma.nursery.findUniqueOrThrow({ where: { id: nurseryId }, select: { subdomain: true, customDomain: true } }),
  ]);
  const origin = tenantOrigin(nursery);

  const categoryOptions = flattenCategoryTree(nurseryCategories);
  const waitingImage = rows.filter((r) => r.imageRequired).length;
  const missingDescription = rows.filter((r) => r.needsDescription).length;

  const needsSeo = rows.filter((r) => r.seo.level !== 'good').length;

  // סינון לפי אות / חיפוש / קטגוריה ומיון (בזיכרון — מלאי של משתלה בודדת)
  const q = searchParams.q?.trim().toLowerCase() || '';
  const letter = parseLetter(searchParams.letter);
  const letters = lettersOf(rows.map((r) => r.title));
  // קטגוריה כוללת את תתי-הקטגוריות שלה; "none" — מוצרים בלי קטגוריה
  const category =
    searchParams.category === 'none' || nurseryCategories.some((c) => c.id === searchParams.category) ? searchParams.category! : '';
  const inCategory = category && category !== 'none' ? new Set(categoryAndDescendantIds(nurseryCategories, category)) : null;
  const { key: sortKey, dir } = parseInventorySort(searchParams.sort, searchParams.dir);
  const visibleRows = sortInventory(
    rows.filter(
      (r) =>
        (!letter || firstLetter(r.title) === letter) &&
        (!q || `${r.title} ${r.latinName ?? ''}`.toLowerCase().includes(q)) &&
        (category !== 'none' || r.categoryIds.length === 0) &&
        (!inCategory || r.categoryIds.some((id) => inCategory.has(id))),
    ),
    sortKey,
    dir,
  );
  const hrefWith = (patch: Record<string, string | null>) => {
    const cur: Record<string, string | null> = { q: q || null, letter, category: category || null, sort: sortKey, dir: sortKey ? dir : null, ...patch };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(cur)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/admin/products?${s}` : '/admin/products';
  };
  const letterHref = (l: string | null) => hrefWith({ letter: l });
  // לחיצה על כותרת: עולה → יורד → ללא מיון
  const sortHref = (k: InventorySortKey) =>
    sortKey !== k ? hrefWith({ sort: k, dir: 'asc' }) : dir === 'asc' ? hrefWith({ sort: k, dir: 'desc' }) : hrefWith({ sort: null, dir: null });
  const sortMark = (k: InventorySortKey) => (sortKey === k ? (dir === 'asc' ? ' ↑' : ' ↓') : '');
  const sortCols: Array<{ key: InventorySortKey; label: string; width: string }> = [
    { key: 'price', label: 'מחיר', width: 'sm:w-24' },
    { key: 'stock', label: 'כמות', width: 'sm:w-20' },
    { key: 'status', label: 'סטטוס', width: 'sm:w-16' },
    { key: 'seo', label: 'SEO', width: 'sm:w-12' },
  ];

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

      {(waitingImage > 0 || missingDescription > 0) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {waitingImage > 0 && (
            <p>
              <strong>{waitingImage} מוצרים מוסתרים מהאתר</strong> עד שתעלו להם תמונה משלכם.
            </p>
          )}
          {missingDescription > 0 && (
            <p>
              <strong>{missingDescription} מוצרים בלי תיאור משלכם</strong> — מוצג התיאור הכללי מהקטלוג. לחצו על שם המוצר כדי לעדכן.
            </p>
          )}
        </div>
      )}

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
            <form method="get" className="flex max-w-2xl flex-wrap gap-3">
              {letter && <input type="hidden" name="letter" value={letter} />}
              {sortKey && <input type="hidden" name="sort" value={sortKey} />}
              {sortKey && <input type="hidden" name="dir" value={dir} />}
              <input
                name="q"
                defaultValue={searchParams.q ?? ''}
                placeholder="חיפוש במלאי..."
                className="min-w-40 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
              {categoryOptions.length > 0 && (
                <select
                  name="category"
                  defaultValue={category}
                  aria-label="סינון לפי קטגוריה"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  <option value="">כל הקטגוריות</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {'  '.repeat(c.depth)}
                      {c.depth > 0 ? '└ ' : ''}
                      {c.name}
                    </option>
                  ))}
                  <option value="none">ללא קטגוריה</option>
                </select>
              )}
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">
                חיפוש
              </button>
            </form>
            <AlphabetBar available={letters} active={letter} hrefFor={letterHref} />
            {(letter || q || category) && (
              <p className="text-xs text-gray-500">
                מוצגים {visibleRows.length} מתוך {rows.length} ·{' '}
                <Link href="/admin/products" className="text-brand-700 hover:underline">
                  ניקוי סינון
                </Link>
              </p>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500" data-testid="inventory-sort">
              <span className="flex-1 sm:pr-[3.75rem]">מוצר</span>
              {sortCols.map((c) => (
                <Link
                  key={c.key}
                  href={sortHref(c.key)}
                  aria-label={`מיון לפי ${c.label}`}
                  className={`${c.width} hover:text-gray-900 ${sortKey === c.key ? 'text-brand-700' : ''}`}
                >
                  {c.label}
                  {sortMark(c.key)}
                </Link>
              ))}
              <span className="hidden w-[4.5rem] sm:block" />
            </div>
            {visibleRows.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">לא נמצאו מוצרים.</p>
            )}
            {visibleRows.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                viewUrl={adminProductViewUrl(origin, { id: product.id, slug: product.slug ?? product.autoSlug, visible: product.isActive && !product.imageRequired })}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
