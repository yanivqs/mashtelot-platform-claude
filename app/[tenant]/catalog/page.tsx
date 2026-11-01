import type { Metadata } from 'next';
import { Breadcrumbs, categoryCrumbHref } from '@/components/storefront/breadcrumbs';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getCatalogPage, getCategoryNav, findCategoryPath, parseFacetParams } from '@/lib/catalog';
import { ProductCard } from '@/components/storefront/product-card';
import { AlphabetBar } from '@/components/alphabet-bar';
import { Pagination } from '@/components/pagination';
import {
  ActiveFilters,
  CatalogSearch,
  CategoryRows,
  FacetList,
  MobileFacets,
  makeHrefBuilder,
} from '@/components/storefront/catalog-filters';
import { SortSelect } from '@/components/storefront/sort-select';
import { CATALOG_SORTS } from '@/lib/catalog-filter';

export const revalidate = 300;

interface CatalogPageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata(props: CatalogPageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) return {};

  const q = searchParams.q?.trim();
  const category = findCategoryPath(await getCategoryNav(nursery.id), searchParams.category).at(-1);
  const title = q
    ? `תוצאות חיפוש: ${q}`
    : category
      ? category.name
      : 'קטלוג הצמחים והציוד';

  // עמודי קטגוריה מאונדקסים (קנוניים); חיפוש/אות/מאפיינים — לא (תוכן דל וכפול)
  const hasRefinements = Boolean(
    q || searchParams.letter || searchParams.sort || Object.keys(parseFacetParams(searchParams)).length,
  );

  return {
    title,
    description: category
      ? `${category.name} ב${nursery.name} — מבחר צמחים ומוצרים עם מחירים מעודכנים והזמנה אונליין.`
      : `עיון בקטלוג המלא של ${nursery.name} - צמחים, שתילים וציוד לגינה עם מחירים מעודכנים.`,
    alternates: {
      canonical: category ? `/catalog?category=${encodeURIComponent(category.slug)}` : '/catalog',
    },
    robots: hasRefinements ? { index: false, follow: true } : undefined,
  };
}

export default async function CatalogPage(props: CatalogPageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const view = await getCatalogPage(nursery.id, searchParams);
  const current: Record<string, string | undefined> = {
    ...searchParams,
    // קטגוריה לא מוכרת (למשל ללא מוצרים) לא נשמרת בקישורים
    category: view.categoryPath.at(-1)?.slug,
    letter: view.letter ?? undefined,
    sort: view.sort === 'recommended' ? undefined : view.sort,
  };
  const href = makeHrefBuilder('/catalog', current);
  const selectedCategory = view.categoryPath.at(-1);
  const activeFacetCount = view.facets.filter((f) => f.selected).length;

  const facetPanel = <FacetList facets={view.facets} href={href} />;

  return (
    <div dir="rtl" className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 border-b border-gray-100 pb-5">
        <Breadcrumbs
          nursery={nursery}
          className="mb-3"
          items={
            view.categoryPath.length > 0 || searchParams.q
              ? [
                  { label: 'קטלוג', href: '/catalog' },
                  ...view.categoryPath.map((c, i) => ({
                    label: c.name,
                    href: i < view.categoryPath.length - 1 || searchParams.q ? categoryCrumbHref(c.slug) : undefined,
                  })),
                  ...(searchParams.q ? [{ label: `חיפוש: ${searchParams.q}` }] : []),
                ]
              : [{ label: 'קטלוג' }]
          }
        />
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {searchParams.q
            ? `תוצאות חיפוש: ${searchParams.q}`
            : selectedCategory?.name ?? 'הקטלוג שלנו'}
        </h1>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">{view.total} מוצרים</p>
          <SortSelect
            value={view.sort}
            options={CATALOG_SORTS.map((s) => ({
              key: s.key,
              label: s.label,
              href: href({ sort: s.key === 'recommended' ? null : s.key, page: null }),
            }))}
          />
        </div>
      </header>

      <div className="mb-6 space-y-5">
        <CatalogSearch basePath="/catalog" current={current} />
        <CategoryRows nav={view.categoryNav} path={view.categoryPath} href={href} />
        <AlphabetBar
          available={view.letters}
          active={view.letter}
          hrefFor={(letter) => href({ letter })}
        />
        <ActiveFilters
          facets={view.facets}
          letter={view.letter}
          q={searchParams.q}
          categoryName={selectedCategory?.name}
          href={href}
          clearHref="/catalog"
        />
        <MobileFacets activeCount={activeFacetCount}>{facetPanel}</MobileFacets>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">{facetPanel}</aside>

        <div>
          {view.items.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-10 text-center text-gray-500">
              לא נמצאו מוצרים התואמים את הסינון.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {view.items.map((product) => (
                <ProductCard key={product.id} product={product} basePath="" />
              ))}
            </div>
          )}

          <Pagination
            page={view.page}
            pageCount={view.pageCount}
            hrefFor={(p) => href({ page: p > 1 ? String(p) : null })}
          />
        </div>
      </div>
    </div>
  );
}
