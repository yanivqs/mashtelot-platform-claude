import type { Nursery } from '@prisma/client';
import { availableQuantity } from '@/lib/stock';
import { getProductCategoryPath, type CatalogProduct } from '@/lib/catalog';
import { Breadcrumbs, categoryCrumbHref } from '@/components/storefront/breadcrumbs';
import { resolveProductContent, productJsonLd, tenantUrl } from '@/lib/seo';
import { ProductPurchase, type PurchaseVariant } from '@/components/storefront/product-purchase';
import { activeVariants, effectiveCompareAt, effectivePrice, variantImages } from '@/lib/variants';
import { PlantFactsGrid } from '@/components/storefront/plant-key-facts';
import { SpecTable } from '@/components/storefront/spec-table';
import { isModuleEnabled } from '@/lib/module-access';
import { ProductPersonal } from '@/components/storefront/product-personal';

/**
 * תוכן דף המוצר — משותף לדף הציבורי ולתצוגה המקדימה מהאדמין.
 * בתצוגה מקדימה: בלי JSON-LD, בלי מועדפים ובלי הוספה לסל.
 */
export async function ProductView({
  nursery,
  product,
  tenant,
  slug,
  preview = false,
}: {
  nursery: Nursery;
  product: CatalogProduct;
  tenant: string;
  slug: string;
  preview?: boolean;
}) {
  const { title, description, image } = resolveProductContent(product);
  const categoryPath = await getProductCategoryPath(nursery.id, product.id);
  // §7.01: וריאנטים פעילים — מחיר, מחיר לפני הנחה, זמינות ותמונות לכל אחד
  const purchaseVariants: PurchaseVariant[] = activeVariants(product.variants).map((v) => {
    const price = effectivePrice(v, product);
    const compareAt = effectiveCompareAt(v, product);
    return {
      id: v.id,
      name: v.name,
      option1: v.option1,
      option2: v.option2,
      colorHex: v.colorHex,
      price,
      compareAt: compareAt !== null && compareAt > price ? compareAt : null,
      available: availableQuantity(v),
      images: variantImages(v, image),
    };
  });
  const plant = product.plant;
  const kicker = plant?.plantType || product.supply?.brand || null;
  const canonicalPath = `/product/${slug}`;
  const care = plant?.care?.trim();
  // R06-04: מועדפים ו"נצפו לאחרונה" — רק כשמודול החשבונות פעיל (המצב נטען בדפדפן)
  const personal =
    !preview && (await isModuleEnabled(nursery.id, 'customer_accounts')) ? <ProductPersonal tenant={tenant} productId={product.id} /> : null;

  const jsonLd = preview ? null : productJsonLd({ nursery, product, variants: product.variants, url: tenantUrl(nursery, canonicalPath) });

  return (
    <div dir="rtl" className="mx-auto max-w-5xl px-6 py-10">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {preview && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          תצוגה מקדימה — המוצר מוסתר מהאתר ורק מי שקיבל את הקישור מהניהול רואה אותו.
        </p>
      )}

      <Breadcrumbs
        nursery={nursery}
        items={[
          { label: 'קטלוג', href: '/catalog' },
          ...categoryPath.map((c) => ({ label: c.name, href: categoryCrumbHref(c.slug) })),
          { label: title },
        ]}
      />

      {purchaseVariants.length > 0 ? (
        <ProductPurchase
          productId={product.id}
          title={title}
          slug={slug}
          optionLabel={product.optionLabel?.trim() || (purchaseVariants.some((v) => v.option2) ? 'גודל' : 'אפשרות')}
          option2Label={product.option2Label?.trim() || 'צבע'}
          variants={purchaseVariants}
          preview={preview}
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
