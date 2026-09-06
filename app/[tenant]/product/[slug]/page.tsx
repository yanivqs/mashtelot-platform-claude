import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getProductById } from '@/lib/catalog';
import { idFromSlug, productSlug, formatPrice } from '@/lib/utils';
import { resolveProductContent, productJsonLd, tenantUrl } from '@/lib/seo';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';

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
  const outOfStock = product.stockQuantity <= 0;
  const plant = product.plant;
  const canonicalPath = `/product/${productSlug(product.id, title)}`;

  const specs: Array<[string, string | null | undefined]> = [
    ['שם לטיני', plant?.latinName],
    ['משפחה', plant?.family],
    ['סוג צמח', plant?.plantType],
    ['תאורה', plant?.light],
    ['השקיה', plant?.water],
    ['עונת פריחה', plant?.floweringSeason],
    ['צבע פריחה', plant?.flowerColor],
    ['גובה', plant?.height],
    ['מרווח שתילה', plant?.spacing],
    ['קצב גדילה', plant?.growthRate],
    ['טיפול', plant?.care],
  ];
  const rows = specs.filter(([, v]) => v && v.trim());

  const jsonLd = productJsonLd({
    nursery,
    product,
    url: tenantUrl(nursery, canonicalPath),
  });

  return (
    <div dir="rtl" className="mx-auto max-w-6xl px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:underline">
          בית
        </Link>{' '}
        /{' '}
        <Link href="/catalog" className="hover:underline">
          קטלוג
        </Link>{' '}
        / <span className="text-gray-700">{title}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-7xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>🪴</span>
          )}
        </div>

        <div>
          {plant?.plantType && (
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {plant.plantType}
            </span>
          )}
          <h1 className="mt-3 text-3xl font-bold text-gray-900">{title}</h1>
          {plant?.latinName && (
            <p className="mt-1 text-sm italic text-gray-400">{plant.latinName}</p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">{formatPrice(price)}</span>
            {product.compareAtPrice && Number(product.compareAtPrice) > price && (
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(Number(product.compareAtPrice))}
              </span>
            )}
          </div>
          <p className={`mt-1 text-sm ${outOfStock ? 'text-red-600' : 'text-brand-700'}`}>
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

          {description && (
            <div className="mt-8">
              <h2 className="mb-2 text-lg font-bold text-gray-900">תיאור</h2>
              <p className="whitespace-pre-line leading-relaxed text-gray-700">{description}</p>
            </div>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-gray-900">מאפיינים בוטניים</h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-gray-100 py-2">
                <dt className="text-sm font-medium text-gray-500">{label}</dt>
                <dd className="text-sm text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
