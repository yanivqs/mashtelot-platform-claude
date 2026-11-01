import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getProductForPreview } from '@/lib/catalog';
import { productSlug } from '@/lib/utils';
import { resolveProductContent } from '@/lib/seo';
import { verifyPreviewToken } from '@/lib/product-preview';
import { ProductView } from '@/components/storefront/product-view';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'תצוגה מקדימה',
  robots: { index: false, follow: false },
};

/** תצוגה מקדימה של מוצר (גם מוסתר) — רק עם קישור חתום שנוצר בניהול. */
export default async function ProductPreviewPage(props: {
  params: Promise<{ tenant: string; id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [params, { t }] = await Promise.all([props.params, props.searchParams]);
  if (!verifyPreviewToken(params.id, t)) notFound();
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();
  const product = await getProductForPreview(nursery.id, params.id);
  if (!product) notFound();

  const slug = productSlug(product.id, resolveProductContent(product).title, product.slug);
  return <ProductView nursery={nursery} product={product} tenant={params.tenant} slug={slug} preview />;
}
