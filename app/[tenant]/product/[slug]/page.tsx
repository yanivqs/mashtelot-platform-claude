import type { Metadata } from 'next';
import { availableQuantity } from '@/lib/stock';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getProductById } from '@/lib/catalog';
import { idFromSlug, productSlug, formatPrice } from '@/lib/utils';
import { resolveProductContent, productJsonLd, tenantUrl } from '@/lib/seo';
import { ProductPurchase, type PurchaseVariant } from '@/components/storefront/product-purchase';
import { activeVariants, effectiveCompareAt, effectivePrice, variantImages } from '@/lib/variants';
import { PlantFactsGrid } from '@/components/storefront/plant-key-facts';
import { SpecTable } from '@/components/storefront/spec-table';
import { redirectOrNotFound } from '@/lib/redirect-resolve';
import { isModuleEnabled } from '@/lib/module-access';
import { ProductPersonal } from '@/components/storefront/product-personal';

export const revalidate = 300;
export const dynamicParams = true;

interface ProductPageProps {
  params: Promise<{ tenant: string; slug: string }>;
}

export async function generateMetadata(props: ProductPageProps): Promise<Metadata> {
  const params = await props.params;
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

export default async function ProductPage(props: ProductPageProps) {
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const product = await getProductById(nursery.id, idFromSlug(params.slug));
  if (!product) return redirectOrNotFound(nursery.id, `/product/${params.slug}`);

  const { title, description, image } = resolveProductContent(product);
  // §7.01: וריאנטים פעילים — מחיר, מחיר לפני הנחה, זמינות ותמונות לכל אחד
  const purchaseVariants: PurchaseVariant[] = activeVariants(product.variants).map((v) => {
    const price = effectivePrice(v, product);
    const compareAt = effectiveCompareAt(v, product);
    return {
      id: v.id,
      name: v.name,
      price,
      compareAt: compareAt !== null && compareAt > price ? compareAt : null,
      available: availableQuantity(v),
      images: variantImages(v, image),
    };
  });
  const plant = product.plant;
  const kicker = plant?.plantType || product.supply?.brand || null;
  const canonicalPath = `/product/${productSlug(product.id, title)}`;
  const care = plant?.care?.trim();
  // R06-04: מועדפים ו"נצפו לאחרונה" — רק כשמודול החשבונות פעיל (המצב נטען בדפדפן)
  const personal = (await isModuleEnabled(nursery.id, 'customer_accounts')) ? <ProductPersonal tenant={params.tenant} productId={product.id} /> : null;

  const jsonLd = productJsonLd({ nursery, product, variants: product.variants, url: tenantUrl(nursery, canonicalPath) });

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

      {purchaseVariants.length > 0 ? (
        <ProductPurchase
          productId={product.id}
          title={title}
          slug={productSlug(product.id, title)}
          optionLabel={product.optionLabel?.trim() || 'אפשרות'}
          variants={purchaseVariants}
          header={
            <>
              {kicker && (
                <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {kicker}
                </span>
              )}
              <h1 className="mt-3 text-3xl font-bold leading-tight text-gray-900">{title}</h1>
              {plant?.latinName && <p className="mt-1 text-sm italic text-gray-400">{plant.latinName}</p>}
              {personal}
            </>
          }
          footer={
            plant ? (
              <div className="mt-8">
                <PlantFactsGrid plant={plant} limit={4} />
              </div>
            ) : null
          }
        />
      ) : (
        <h1 className="text-3xl font-bold leading-tight text-gray-900">{title}</h1>
      )}

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
