import Link from 'next/link';
import { formatPrice, productSlug } from '@/lib/utils';
import { resolveProductContent } from '@/lib/seo';
import type { CatalogProduct } from '@/lib/catalog';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';

export function ProductCard({
  product,
  basePath,
}: {
  product: CatalogProduct;
  basePath: string;
}) {
  const { title, description, image } = resolveProductContent(product);
  const slug = productSlug(product.id, title);
  const href = `${basePath}/product/${slug}`;
  const price = Number(product.price);
  const outOfStock = product.stockQuantity <= 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md">
      <Link href={href} className="block">
        <div className="flex h-48 items-center justify-center bg-brand-50 text-4xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span aria-hidden>🪴</span>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {product.plant?.plantType && (
          <span className="mb-2 w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            {product.plant.plantType}
          </span>
        )}
        <Link href={href}>
          <h3 className="text-base font-bold text-gray-900 hover:text-brand-700">{title}</h3>
        </Link>
        {product.plant?.latinName && (
          <p className="mb-1 text-xs italic text-gray-400">{product.plant.latinName}</p>
        )}
        <p className="mb-4 line-clamp-2 text-sm text-gray-600">{description}</p>
        <div className="mt-auto">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900">{formatPrice(price)}</span>
            {product.compareAtPrice && Number(product.compareAtPrice) > price && (
              <span className="text-sm text-gray-400 line-through">
                {formatPrice(Number(product.compareAtPrice))}
              </span>
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
