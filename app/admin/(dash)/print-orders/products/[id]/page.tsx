import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parsePriceTiers } from '@/lib/print-pricing';
import { deletePrintProduct } from '../../actions';
import { PrintProductForm, type PrintProductFormValues } from '../product-form';

export const dynamic = 'force-dynamic';

export default async function EditPrintProductPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireUser(['SUPER_ADMIN']);
  const isNew = params.id === 'new';

  const [product, categoryRows] = await Promise.all([
    isNew ? null : prisma.printProduct.findUnique({
      where: { id: params.id },
      include: { _count: { select: { items: true } } },
    }),
    prisma.printProduct.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    }),
  ]);
  if (!isNew && !product) notFound();

  const values: PrintProductFormValues = product
    ? {
        id: product.id,
        title: product.title,
        category: product.category,
        description: product.description,
        specs: product.specs,
        imageUrl: product.imageUrl,
        basePrice: product.basePrice.toString(),
        unitLabel: product.unitLabel,
        minQuantity: product.minQuantity,
        leadTimeDays: product.leadTimeDays,
        priceTiers: parsePriceTiers(product.priceTiers),
        requiresArtwork: product.requiresArtwork,
        allowOptions: product.allowOptions,
        isActive: product.isActive,
        sortOrder: product.sortOrder,
      }
    : {
        id: 'new',
        title: '',
        category: null,
        description: null,
        specs: null,
        imageUrl: null,
        basePrice: '',
        unitLabel: null,
        minQuantity: 1,
        leadTimeDays: null,
        priceTiers: [],
        requiresArtwork: false,
        allowOptions: true,
        isActive: true,
        sortOrder: 0,
      };

  const ordered = product?._count.items ?? 0;

  return (
    <div className="max-w-3xl">
      <Link href="/admin/print-orders/products" className="text-sm text-gray-500 hover:underline">
        → מוצרי דפוס
      </Link>
      <h1 className="mb-6 mt-1 text-2xl font-bold">{isNew ? 'מוצר דפוס חדש' : `עריכה: ${product!.title}`}</h1>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PrintProductForm
          product={values}
          categories={categoryRows.map((c) => c.category!).filter(Boolean)}
        />
      </div>

      {!isNew && (
        <form action={deletePrintProduct} className="mt-6 flex items-center gap-3">
          <input type="hidden" name="id" value={product!.id} />
          <button className="text-sm font-medium text-red-600 hover:text-red-800">
            {ordered > 0 ? 'הסרה מהקטלוג (כיבוי)' : 'מחיקת המוצר'}
          </button>
          {ordered > 0 && (
            <span className="text-xs text-gray-400">
              המוצר הוזמן בעבר, ולכן יכובה ולא יימחק (שמירת היסטוריית הזמנות).
            </span>
          )}
        </form>
      )}
    </div>
  );
}
