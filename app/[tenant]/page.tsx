import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getFeaturedProducts } from '@/lib/catalog';
import { getNurseryTheme } from '@/lib/theme';
import { ProductCard } from '@/components/storefront/product-card';
import { Hero } from '@/components/storefront/hero';

export const revalidate = 300;

export default async function TenantHomePage({ params }: { params: { tenant: string } }) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const featured = await getFeaturedProducts(nursery.id, 8);
  const theme = getNurseryTheme(nursery);

  return (
    <div dir="rtl">
      <Hero nursery={nursery} theme={theme} />

      {nursery.aboutText?.trim() && (
        <section className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="whitespace-pre-line text-lg leading-relaxed text-gray-700">
            {nursery.aboutText}
          </p>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold text-gray-900">מוצרים נבחרים</h2>
          <Link href="/catalog" className="text-sm font-medium text-brand-700 hover:underline">
            הצג הכל
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-10 text-center text-gray-500">
            הקטלוג מתעדכן. חזרו בקרוב.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} basePath="" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
