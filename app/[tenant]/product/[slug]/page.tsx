import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getProductById } from '@/lib/catalog';
import { idFromSlug, productSlug, formatPrice } from '@/lib/utils';
import { resolveProductContent, productJsonLd, tenantUrl } from '@/lib/seo';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { PlantFactsGrid } from '@/components/storefront/plant-key-facts';
import { SpecTable } from '@/components/storefront/spec-table';

export const revalidate = 300;
export const dynamicParams = true;

interface ProductPageProps {
  params: { tenant: string; slug: string };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) return {};

  const product = await getProductById(nursery.id, idFromSlug(params.slug));
  if (!product) return { title: 'המוצר לא נמצא' };

  const { title, metaTitle, metaDescription, image } = resolveProductContent(product);
  const canonical = `/product/${productSlug(product.id, title)}`;

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: 'website',
      url: tenantUrl(nursery, canonical),
      images: image ? [{ url: image }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const product = await getProductById(nursery.id, idFromSlug(params.slug));
  if (!product) notFound();

  const { title, description, image } = resolveProductContent(product);
  const price = Number(product.price);
  const compareAt = product.compareAtPrice ? Number(product.compareAtPrice) : null;
  const onSale = compareAt !== null && compareAt > price;
  const outOfStock = product.stockQuantity <= 0;
  const plant = product.plant;
  const kicker = plant?.plantType || product.supply?.brand || null;
  const canonicalPath = `/product/${productSlug(product.id, title)}`;
  const care = plant?.care?.trim();

  const jsonLd = productJsonLd({ nursery, product, url: tenantUrl(nursery, canonicalPath) });

  return (
    <div dir="rtl" className="mx-auto max-w-5xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:underline">בית</Link> /{' '}
        <Link href="/catalog" className="hover:underline">קטלוג</Link> /{' '}
        <span className="text-gray-700">{title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-7xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>🪴</span>
          )}
        </div>

        <div className="flex flex-col">
          {kicker && (
            <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {kicker}
            </span>
          )}
          <h1 className="mt-3 text-3xl font-bold leading-tight text-gray-900">{title}</h1>
          {plant?.latinName && (
            <p className="mt-1 text-sm italic text-gray-400">{plant.latinName}</p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">{formatPrice(price)}</span>
            {onSale && (
              <span className="text-lg text-gray-400 line-through">{formatPrice(compareAt!)}</span>
            )}
          </div>
          <p className={`mt-1 text-sm ${outOfStock ? 'text-rose-600' : 'text-brand-700'}`}>
            {outOfStock ? 'אזל מהמלאי' : `במלאי (${product.stockQuantity} יח')`}
          </p>

          <div className="mt-6 max-w-sm">
            <AddToCartButton
              withQuantity
              disabled={outOfStock}
              product={{
                productId: product.id,
                title,
                price,
                image,
                slug: productSlug(product.id, title),
              }}
            />
          </div>

          {plant && (
            <div className="mt-8">
              <PlantFactsGrid plant={plant} limit={4} />
            </div>
          )}
        </div>
      </div>

      {description && (
        <section className="mt-12">
          <h2 className="mb-3 text-lg font-bold text-gray-900">תיאור</h2>
          <p className="whitespace-pre-line leading-relaxed text-gray-700">{description}</p>
        </section>
      )}

      {plant && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-gray-900">מאפיינים בוטניים</h2>
          <SpecTable plant={plant} />
        </section>
      )}

      {care && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-gray-900">הנחיות טיפול</h2>
          <p className="whitespace-pre-line leading-relaxed text-gray-700">{care}</p>
        </section>
      )}
    </div>
  );
}
