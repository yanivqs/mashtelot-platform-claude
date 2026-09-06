import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getNurseryByTenant } from '@/lib/tenant';
import { getFeaturedProducts } from '@/lib/catalog';
import { ProductCard } from '@/components/storefront/product-card';

export const revalidate = 300;

export default async function TenantHomePage({ params }: { params: { tenant: string } }) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const featured = await getFeaturedProducts(nursery.id, 8);

  return (
    <div dir="rtl">
      <section className="bg-brand-50">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h1 className="text-3xl font-bold text-brand-900 sm:text-4xl">{nursery.name}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            ברוכים הבאים לחנות המקוונת שלנו. עיינו בקטלוג הצמחים והציוד המקצועי והזמינו אונליין.
          </p>
          <Link
            href="/catalog"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--brand,#16a34a)] px-6 py-3 font-medium text-white transition hover:brightness-95"
          >
            לכל הקטלוג
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold text-gray-900">מוצרים נבחרים</h2>
          <Link href="/catalog" className="text-sm font-medium text-brand-700 hover:underline">
            הצג הכל
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
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
