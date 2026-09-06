import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getCatalog, getPlantTypes } from '@/lib/catalog';
import { ProductCard } from '@/components/storefront/product-card';
import { CatalogFilters } from '@/components/storefront/catalog-filters';

export const revalidate = 300;

interface CatalogPageProps {
  params: { tenant: string };
  searchParams: { q?: string; type?: string; page?: string };
}

export async function generateMetadata({
  params,
  searchParams,
}: CatalogPageProps): Promise<Metadata> {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) return {};

  const q = searchParams.q?.trim();
  const title = q ? `תוצאות חיפוש: ${q}` : 'קטלוג הצמחים והציוד';
  // דפי חיפוש/סינון לא מאונדקסים (תוכן דל/כפול); דפדוף רגיל כן
  const hasFilters = Boolean(q || searchParams.type);

  return {
    title,
    description: `עיון בקטלוג המלא של ${nursery.name} - צמחים, שתילים וציוד לגינה עם מחירים מעודכנים.`,
    alternates: { canonical: '/catalog' },
    // אין אינדוקס לדפי חיפוש/סינון כדי למנוע תוכן דל וכפול
    robots: hasFilters ? { index: false, follow: true } : undefined,
  };
}

export default async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const [{ items, total, pageCount }, plantTypes] = await Promise.all([
    getCatalog({
      nurseryId: nursery.id,
      q: searchParams.q,
      plantType: searchParams.type,
      page,
    }),
    getPlantTypes(nursery.id),
  ]);

  const buildPageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (searchParams.q) sp.set('q', searchParams.q);
    if (searchParams.type) sp.set('type', searchParams.type);
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `/catalog?${qs}` : '/catalog';
  };

  return (
    <div dir="rtl" className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">קטלוג</h1>
      <p className="mb-6 text-sm text-gray-500">{total} מוצרים</p>

      <CatalogFilters plantTypes={plantTypes} />

      {items.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-10 text-center text-gray-500">
          לא נמצאו מוצרים התואמים את החיפוש.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} basePath="" />
            ))}
          </div>

          {pageCount > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={buildPageHref(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={
                    p === page
                      ? 'rounded-md bg-brand-600 px-3.5 py-2 text-sm font-medium text-white'
                      : 'rounded-md border border-gray-200 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50'
                  }
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
