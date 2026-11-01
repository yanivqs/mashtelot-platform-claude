import type { Nursery, Plant, MasterSupply, NurseryProduct, ProductVariant } from '@prisma/client';
import { availableQuantity, sellableQuantity } from '@/lib/stock';
import { activeVariants, effectivePrice, priceSummary } from '@/lib/variants';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost:3000';
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

  const image =
    product.customImageUrl || product.plant?.imageUrl || product.supply?.imageUrl || null;

  const metaTitle = product.seoMetaTitle || title;
  const metaDescription =
    product.seoMetaDescription ||
    description.slice(0, 160) ||
    `${title} - זמין לרכישה אונליין`;

  return { title, description, image, metaTitle, metaDescription };
}

/** Build a Schema.org/GardenStore (LocalBusiness) JSON-LD object for the storefront. */
export function localBusinessJsonLd(nursery: Nursery) {
  const hasAddress = Boolean(nursery.addressLine || nursery.city);
  return {
    '@context': 'https://schema.org/',
    '@type': 'GardenStore',
    name: nursery.name,
    url: tenantOrigin(nursery),
    image: nursery.logoUrl || undefined,
    telephone: nursery.phoneNumber || undefined,
    email: nursery.contactEmail || nursery.ownerEmail || undefined,
    address: hasAddress
      ? {
          '@type': 'PostalAddress',
          streetAddress: nursery.addressLine || undefined,
          addressLocality: nursery.city || undefined,
          addressCountry: 'IL',
        }
      : undefined,
  };
}

/** Build a Schema.org/Product JSON-LD object for a product page. */
export function productJsonLd(params: {
  nursery: Nursery;
  product: ProductWithRefs;
  /** וריאנטים (§7.01); חסר = לפי מחיר/מלאי המוצר */
  variants?: ProductVariant[];
  url: string;
}) {
  const { nursery, product, url } = params;
  const { title, description, image } = resolveProductContent(product);
  const variants = activeVariants(params.variants ?? []);
  const inStock = product.alwaysInStock || (variants.length ? variants.some((v) => sellableQuantity(v, product) > 0) : availableQuantity(product) > 0);
  const availability = inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
  const seller = { '@type': 'Organization', name: nursery.name };

  // §7.01: כמה וריאנטים → טווח מחירים (AggregateOffer)
  if (variants.length > 1) {
    const s = priceSummary(variants, product);
    return {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: title,
      description: description || title,
      image: image ? [image] : undefined,
      sku: product.id,
      brand: { '@type': 'Brand', name: nursery.name },
      offers: {
        '@type': 'AggregateOffer',
        url,
        priceCurrency: 'ILS',
        lowPrice: s.min.toFixed(2),
        highPrice: s.max.toFixed(2),
        offerCount: variants.length,
        availability,
        seller,
      },
    };
  }

  const only = variants[0];
  const price = only ? effectivePrice(only, product).toFixed(2) : product.price.toString();

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: title,
    description: description || title,
    image: image ? [image] : undefined,
    sku: only?.sku || product.id,
    brand: { '@type': 'Brand', name: nursery.name },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'ILS',
      price,
      availability,
      seller,
    },
  };
}

/** JSON-LD בטוח לתוך <script>: תוכן של בעל המשתלה לא יכול לסגור את התגית. */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Schema.org/BlogPosting למאמר בבלוג. המחבר הוא המשתלה — אין שדה מחבר אישי. */
export function articleJsonLd(
  nursery: Pick<Nursery, 'name' | 'subdomain' | 'customDomain' | 'logoUrl'>,
  post: {
    slug: string;
    title: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  const organization = { '@type': 'Organization', name: nursery.name, url: tenantOrigin(nursery) };
  return {
    '@context': 'https://schema.org/',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: organization,
    publisher: {
      ...organization,
      logo: nursery.logoUrl ? { '@type': 'ImageObject', url: nursery.logoUrl } : undefined,
    },
    mainEntityOfPage: tenantUrl(nursery, `/blog/${post.slug}`),
  };
}
