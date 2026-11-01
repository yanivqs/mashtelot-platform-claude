import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getStoreShareImage } from '@/lib/share-image';
import { getProductByParam } from '@/lib/catalog';
import { productSlug } from '@/lib/utils';
import { resolveProductContent, tenantUrl } from '@/lib/seo';
import { redirectOrNotFound } from '@/lib/redirect-resolve';
import { ProductView } from '@/components/storefront/product-view';

export const revalidate = 300;

function decodeParam(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}
export const dynamicParams = true;

interface ProductPageProps {
  params: Promise<{ tenant: string; slug: string }>;
}

export async function generateMetadata(props: ProductPageProps): Promise<Metadata> {
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) return {};

  const product = await getProductByParam(nursery.id, decodeParam(params.slug));
  if (!product) return { title: 'המוצר לא נמצא' };

  const { title, metaTitle, metaDescription, image } = resolveProductContent(product);
  const canonical = `/product/${productSlug(product.id, title, product.slug)}`;
  const shareImage = await getStoreShareImage(nursery);

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: 'website',
      url: tenantUrl(nursery, canonical),
      images: image || shareImage ? [{ url: (image || shareImage)! }] : undefined,
    },
  };
}

export default async function ProductPage(props: ProductPageProps) {
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const param = decodeParam(params.slug);
  const product = await getProductByParam(nursery.id, param);
  if (!product) return redirectOrNotFound(nursery.id, `/product/${params.slug}`);

  const { title } = resolveProductContent(product);
  const slug = productSlug(product.id, title, product.slug);
  // כתובת ישנה (מזהה מלא) או לא עדכנית — הפניה קבועה לכתובת הנוכחית
  if (param !== slug) permanentRedirect(`/product/${encodeURIComponent(slug)}`);

  return <ProductView nursery={nursery} product={product} tenant={params.tenant} slug={slug} />;
}
