import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { PrintOrderForm, type PrintProductVM } from './order-form';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  NEW: 'התקבלה',
  IN_PRODUCTION: 'בהפקה',
  SHIPPED: 'נשלחה',
  DELIVERED: 'נמסרה',
  CANCELLED: 'בוטלה',
};

export default async function PrintShopPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireModule('print_shop');
  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);

  const [products, options, orders] = await Promise.all([
    prisma.printProduct.findMany({ where: { isActive: true }, orderBy: { basePrice: 'asc' } }),
    prisma.printGlobalOption.findMany({ orderBy: { optionName: 'asc' } }),
    nurseryId
      ? prisma.printOrder.findMany({
          where: { nurseryId },
          include: { items: { include: { printProduct: { select: { title: true } } } } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const vm: PrintProductVM[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    basePrice: p.basePrice.toString(),
    minQuantity: p.minQuantity,
  }));

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">בית דפוס (הזמנות B2B)</h1>
      <p className="mb-6 text-sm text-gray-500">
        הזמנת שלטים, תוויות ופריטי מיתוג לחנות מבית הדפוס של הפלטפורמה.
      </p>

      <PrintOrderForm products={vm} options={options.map((o) => ({ optionName: o.optionName, extraPrice: o.extraPrice.toString() }))} />

      {orders.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-bold text-gray-900">ההזמנות שלי</h2>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {o.createdAt.toLocaleDateString('he-IL')}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <ul className="mt-2 text-sm text-gray-600">
                  {o.items.map((it) => (
                    <li key={it.id}>
                      {it.printProduct.title} × {it.quantity}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-sm font-medium">{formatPrice(o.totalAmount.toString())}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
