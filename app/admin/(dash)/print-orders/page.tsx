import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { PrintStatusSelect, NewPrintProductForm } from './controls';
import { togglePrintProduct } from './actions';

export const dynamic = 'force-dynamic';

export default async function PrintOrdersPage() {
  await requireUser(['SUPER_ADMIN']);

  const [orders, products] = await Promise.all([
    prisma.printOrder.findMany({
      include: {
        nursery: { select: { name: true } },
        orderedBy: { select: { email: true } },
        items: { include: { printProduct: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.printProduct.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">הזמנות דפוס נכנסות</h1>
        <p className="text-sm text-gray-500">{orders.length} הזמנות מהמשתלות</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          אין הזמנות דפוס עדיין.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{o.nursery.name}</p>
                  <p className="text-xs text-gray-400">
                    {o.createdAt.toLocaleString('he-IL')}
                    {o.orderedBy?.email ? ` · ${o.orderedBy.email}` : ''}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(o.totalAmount.toString())}
                  </p>
                  <div className="mt-1">
                    <PrintStatusSelect id={o.id} status={o.status} />
                  </div>
                </div>
              </div>
              <ul className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                {o.items.map((it) => (
                  <li key={it.id} className="flex justify-between py-0.5">
                    <span>
                      {it.printProduct.title} × {it.quantity}
                      {it.customText ? ` — "${it.customText}"` : ''}
                    </span>
                    <span>{formatPrice(Number(it.unitPrice) * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              {(o.notes || o.artworkUrl) && (
                <div className="mt-2 space-y-1 text-sm">
                  {o.notes && <p className="text-gray-500">הערות: {o.notes}</p>}
                  {o.artworkUrl && (
                    <a
                      href={o.artworkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      קובץ גרפי מצורף ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-bold text-gray-900">קטלוג מוצרי הדפוס</h2>
        <div className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <NewPrintProductForm />
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{p.title}</p>
                <p className="text-xs text-gray-400">
                  {formatPrice(p.basePrice.toString())} ליח׳ · מינ׳ {p.minQuantity}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.isActive ? 'פעיל' : 'כבוי'}
              </span>
              <form action={togglePrintProduct}>
                <input type="hidden" name="id" value={p.id} />
                <button className="text-xs text-gray-500 hover:text-gray-800">
                  {p.isActive ? 'כבה' : 'הפעל'}
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
