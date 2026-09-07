import Link from 'next/link';
import { formatPrice, productSlug } from '@/lib/utils';
import { resolveProductContent } from '@/lib/seo';
import type { CatalogProduct } from '@/lib/catalog';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { PlantFactsInline } from '@/components/storefront/plant-key-facts';

export function ProductCard({
  product,
  basePath,
}: {
  product: CatalogProduct;
  basePath: string;
}) {
  const { title, image } = resolveProductContent(product);
  const slug = productSlug(product.id, title);
  const href = `${basePath}/product/${slug}`;
  const price = Number(product.price);
  const compareAt = product.compareAtPrice ? Number(product.compareAtPrice) : null;
  const onSale = compareAt !== null && compareAt > price;
  const outOfStock = product.stockQuantity <= 0;
  const kicker = product.plant?.plantType || product.supply?.brand || null;

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
        {kicker && (
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {kicker}
          </span>
        )}

        <Link href={href}>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-gray-900 transition group-hover:text-brand-700">
            {title}
          </h3>
        </Link>
        {product.plant?.latinName && (
          <p className="-mt-1 text-xs italic text-gray-400">{product.plant.latinName}</p>
        )}

        <PlantFactsInline plant={product.plant} limit={3} />

        <div className="mt-auto pt-2">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900">{formatPrice(price)}</span>
            {onSale && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(compareAt!)}</span>
            )}
          </div>
          <AddToCartButton
            withQuantity={false}
            disabled={outOfStock}
            product={{ productId: product.id, title, price, image, slug }}
          />
        </div>
      </div>
    </div>
  );
}
