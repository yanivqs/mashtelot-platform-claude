import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';
import { tenantOrigin } from '@/lib/seo';
import { adminProductViewUrl } from '@/lib/product-preview';
import { aiSlugAvailable } from '@/lib/ai-slug';
import { loadAdminProducts } from '../load';
import { ProductEditor } from '../product-editor';

export const dynamic = 'force-dynamic';

export default async function EditProductPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const [{ id }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });

  const [[product], categories, nursery] = await Promise.all([
    loadAdminProducts(nurseryId, { id }),
    prisma.nurseryCategory.findMany({ where: { nurseryId } }),
    prisma.nursery.findUniqueOrThrow({ where: { id: nurseryId }, select: { subdomain: true, customDomain: true } }),
  ]);
  if (!product) notFound();

  const origin = tenantOrigin(nursery);
  const visible = product.isActive && !product.imageRequired;
  const isNew = searchParams.new === '1';

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowRight className="h-4 w-4" />
        המלאי שלי
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold sm:text-2xl">{product.customTitle || product.title}</h1>
          <p className="text-sm text-gray-500">
            {product.kind}
            {product.latinName ? ` · ${product.latinName}` : ''}
            {' · '}
            <span className={visible ? 'text-green-700' : 'text-gray-500'}>{visible ? 'מוצג באתר' : 'מוסתר מהאתר'}</span>
          </p>
        </div>
        <a
            href={adminProductViewUrl(origin, { id: product.id, slug: product.slug ?? product.autoSlug, visible })}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            {visible ? 'צפייה באתר' : 'תצוגה מקדימה'}
          </a>
      </div>

      {(isNew || product.imageRequired || product.needsDescription) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">{isNew ? 'המוצר נוסף לחנות — נשאר להשלים 2 דברים:' : 'נשאר להשלים:'}</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {product.imageRequired && <li>תמונה משלכם — עד שתועלה, המוצר מוסתר מהאתר.</li>}
            {product.needsDescription && <li>תיאור ייחודי — כרגע מוצג התיאור הכללי מהקטלוג.</li>}
            {isNew && !product.imageRequired && !product.needsDescription && <li>הכול מוכן.</li>}
          </ul>
        </div>
      )}

      <ProductEditor
        product={product}
        categoryOptions={flattenCategoryTree(categories)}
        aiAvailable={aiSlugAvailable()}
        storeOrigin={origin}
      />
    </div>
  );
}
