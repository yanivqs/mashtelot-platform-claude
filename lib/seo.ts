import type { Nursery, Plant, MasterSupply, NurseryProduct } from '@prisma/client';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
const PROTOCOL = ROOT_DOMAIN.startsWith('localhost') ? 'http' : 'https';

/** Absolute origin for a tenant storefront (custom domain wins over subdomain). */
export function tenantOrigin(nursery: Pick<Nursery, 'subdomain' | 'customDomain'>): string {
  if (nursery.customDomain) {
    return `https://${nursery.customDomain}`;
  }
  return `${PROTOCOL}://${nursery.subdomain}.${ROOT_DOMAIN}`;
}

export function tenantUrl(
  nursery: Pick<Nursery, 'subdomain' | 'customDomain'>,
  path = '/',
): string {
  return `${tenantOrigin(nursery)}${path.startsWith('/') ? path : `/${path}`}`;
}

type ProductWithRefs = NurseryProduct & {
  plant: Plant | null;
  supply: MasterSupply | null;
};

/** Resolve the display fields for a nursery product, honoring SEO overrides. */
export function resolveProductContent(product: ProductWithRefs) {
  const title =
    product.customTitle ||
    product.plant?.hebrewName ||
    product.supply?.title ||
    'מוצר ללא שם';

  const description =
    product.customDescription ||
    product.plant?.description ||
    product.supply?.description ||
    '';

  const image = product.plant?.imageUrl || product.supply?.imageUrl || null;

  const metaTitle = product.seoMetaTitle || title;
  const metaDescription =
    product.seoMetaDescription ||
    description.slice(0, 160) ||
    `${title} - זמין לרכישה אונליין`;

  return { title, description, image, metaTitle, metaDescription };
}

/** Build a Schema.org/Product JSON-LD object for a product page. */
export function productJsonLd(params: {
  nursery: Nursery;
  product: ProductWithRefs;
  url: string;
}) {
  const { nursery, product, url } = params;
  const { title, description, image } = resolveProductContent(product);
  const price = product.price.toString();

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: title,
    description: description || title,
    image: image ? [image] : undefined,
    sku: product.id,
    brand: { '@type': 'Brand', name: nursery.name },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'ILS',
      price,
      availability:
        product.stockQuantity > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: nursery.name },
    },
  };
}
