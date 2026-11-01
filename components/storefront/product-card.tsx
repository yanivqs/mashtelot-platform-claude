import Link from 'next/link';
import { formatPrice, productSlug } from '@/lib/utils';
import { resolveProductContent } from '@/lib/seo';
import type { CatalogProduct } from '@/lib/catalog';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { PlantFactsInline } from '@/components/storefront/plant-key-facts';
import { activeVariants, optionMatrix, priceSummary } from '@/lib/variants';

export function ProductCard({
  product,
  basePath,
  categoryLabel,
}: {
  product: CatalogProduct;
  basePath: string;
  /** שם הקטגוריה להצגה בכרטיס (בלוק "מגוון") — במקום סוג הצמח / המותג */
  categoryLabel?: string | null;
}) {
  const { title, image } = resolveProductContent(product);
  const slug = productSlug(product.id, title, product.slug);
  const href = `${basePath}/product/${slug}`;
  // §7.01: מחיר וזמינות לפי הווריאנטים הפעילים
  const variants = activeVariants(product.variants);
  const summary = priceSummary(variants, product);
  const price = summary.min;
  const compareAt = summary.compareAt;
  const onSale = compareAt !== null;
  const outOfStock = !summary.inStock;
  const choice = variants.length > 1;
  const kicker = categoryLabel || product.plant?.plantType || product.supply?.brand || null;
  // ציר צבע: דוגמיות קטנות בכרטיס; שני צירים — "לבחירת גודל וצבע"
  const matrix = choice ? optionMatrix(variants) : null;
  const twoAxes = Boolean(matrix?.axis2.length);
  const swatches = (twoAxes ? matrix!.axis2 : (matrix?.axis1 ?? [])).filter((o) => o.colorHex);
  const chooseLabel = twoAxes
    ? `לבחירת ${product.optionLabel?.trim() || 'גודל'} ו${product.option2Label?.trim() || 'צבע'}`
    : `לבחירת ${product.optionLabel?.trim() || 'אפשרות'}`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-brand-50">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>
            🪴
          </span>
        )}
        {onSale && (
          <span className="absolute right-3 top-3 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
            מבצע
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-gray-900/70 py-1 text-center text-xs font-medium text-white">
            אזל מהמלאי
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {kicker &&
          (categoryLabel ? (
            <span
              className="w-fit rounded-full px-2 py-0.5 text-[11px] font-bold text-[var(--accent,#16a34a)]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent, #16a34a) 12%, transparent)' }}
              data-testid="card-category"
            >
              {kicker}
            </span>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">{kicker}</span>
          ))}

        <Link href={href}>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-gray-900 transition group-hover:text-brand-700">
            {title}
          </h3>
        </Link>
        {product.plant?.latinName && (
          <p className="-mt-1 text-xs italic text-gray-400">{product.plant.latinName}</p>
        )}

        <PlantFactsInline plant={product.plant} limit={3} />

        {swatches.length > 0 && (
          <div className="flex items-center gap-1" aria-label={`צבעים: ${swatches.map((o) => o.value).join(', ')}`}>
            {swatches.slice(0, 6).map((o) => (
              <span key={o.value} title={o.value} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: o.colorHex! }} />
            ))}
          </div>
        )}

        <div className="mt-auto pt-2">
          <div className="mb-3 flex items-baseline gap-2">
            {choice && summary.min !== summary.max && <span className="text-xs text-gray-500">החל מ-</span>}
            <span className="text-lg font-bold text-gray-900">{formatPrice(price)}</span>
            {onSale && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(compareAt!)}</span>
            )}
          </div>
          {choice ? (
            // כמה וריאנטים — הבחירה נעשית בדף המוצר
            <Link
              href={href}
              className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--brand,#16a34a)] px-4 py-2.5 text-sm font-medium text-[var(--brand,#16a34a)] transition hover:bg-brand-50"
            >
              {outOfStock ? 'אזל מהמלאי' : chooseLabel}
            </Link>
          ) : (
            <AddToCartButton
              withQuantity={false}
              disabled={outOfStock}
              product={{ productId: product.id, variantId: variants[0]?.id ?? null, title, price, image, slug }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
