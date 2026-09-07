import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { requireAnyModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { resolveProductContent } from '@/lib/seo';
import { ProductRow, type RowProduct } from './product-row';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireAnyModule(['plant_catalog', 'supplies']);

  const nurseryId =
    user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : user.nurseryId;

  if (!nurseryId) {
    return <p className="text-gray-500">אין משתלה משויכת.</p>;
  }

  const products = await prisma.nurseryProduct.findMany({
    where: { nurseryId },
    include: { plant: true, supply: true },
    orderBy: { createdAt: 'desc' },
  });

  const rows: RowProduct[] = products.map((p) => {
    const { title, image } = resolveProductContent(p);
    return {
      id: p.id,
      title,
      latinName: p.plant?.latinName ?? null,
      image,
      kind: p.plantId ? 'צמח' : 'ציוד',
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      stockQuantity: p.stockQuantity,
      isActive: p.isActive,
      customTitle: p.customTitle,
      customDescription: p.customDescription,
      seoMetaTitle: p.seoMetaTitle,
      seoMetaDescription: p.seoMetaDescription,
    };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">המלאי שלי</h1>
          <p className="text-sm text-gray-500">{rows.length} מוצרים</p>
        </div>
        <Link
          href="/admin/products/browse"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          הוספת מוצרים
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          עדיין לא הוספת מוצרים.{' '}
          <Link href="/admin/products/browse" className="font-medium text-brand-700 hover:underline">
            עבור לקטלוג הבוטני
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {rows.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
