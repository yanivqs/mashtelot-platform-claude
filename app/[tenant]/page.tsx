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
      <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-24">
          {nursery.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nursery.logoUrl}
              alt={nursery.name}
              className="mx-auto mb-6 h-16 w-auto"
            />
          )}
          <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
            {nursery.name}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
            צמחים, שתילים וציוד גינון מקצועי — עם מחירים מעודכנים והזמנה אונליין נוחה.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand,#16a34a)] px-7 py-3.5 font-medium text-white shadow-sm transition hover:brightness-95"
            >
              לכל הקטלוג
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {(nursery.phoneNumber || nursery.whatsappNumber) && (
              <a
                href={`tel:${nursery.phoneNumber || nursery.whatsappNumber}`}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-7 py-3.5 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                דברו איתנו
              </a>
            )}
          </div>
        </div>
      </section>

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
