import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { parsePriceTiers } from '@/lib/print-pricing';
import { PrintOptionForm } from '../controls';
import { togglePrintProduct, duplicatePrintProduct } from '../actions';

export const dynamic = 'force-dynamic';

export default async function PrintProductsPage() {
  await requireUser(['SUPER_ADMIN']);

  const [products, options] = await Promise.all([
    prisma.printProduct.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.printGlobalOption.findMany({ orderBy: { optionName: 'asc' } }),
  ]);

  const groups = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.category || 'ללא קטגוריה';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  return (
    <div className="max-w-4xl space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/print-orders" className="text-sm text-gray-500 hover:underline">
            → הזמנות דפוס
          </Link>
          <h1 className="text-2xl font-bold">מוצרי הדפוס המוצעים למשתלות</h1>
          <p className="text-sm text-gray-500">{products.length} מוצרים</p>
        </div>
        <Link
          href="/admin/print-orders/products/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + מוצר דפוס חדש
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          אין עדיין מוצרי דפוס.
        </div>
      ) : (
        [...groups].map(([category, list]) => (
          <section key={category}>
            <h2 className="mb-2 text-sm font-bold text-gray-500">{category}</h2>
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              {list.map((p) => {
                const tiers = parsePriceTiers(p.priceTiers);
                return (
                  <div key={p.id} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span aria-hidden>🖨️</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/print-orders/products/${p.id}`}
                        className="text-sm font-medium text-gray-900 hover:underline"
                      >
                        {p.title}
                      </Link>
                      <p className="text-xs text-gray-400">
                        {formatPrice(p.basePrice.toString())} ל{p.unitLabel || 'יח׳'} · מינ׳ {p.minQuantity}
                        {tiers.length > 0 && ` · ${tiers.length} מדרגות כמות`}
                        {p.leadTimeDays !== null && ` · ${p.leadTimeDays} ימי אספקה`}
                        {p._count.items > 0 && ` · הוזמן ${p._count.items} פעמים`}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {p.isActive ? 'פעיל' : 'כבוי'}
                    </span>
                    <Link
                      href={`/admin/print-orders/products/${p.id}`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      עריכה
                    </Link>
                    <form action={duplicatePrintProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-xs text-gray-500 hover:text-gray-800">שכפול</button>
                    </form>
                    <form action={togglePrintProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-xs text-gray-500 hover:text-gray-800">
                        {p.isActive ? 'כבה' : 'הפעל'}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <section>
        <h2 className="mb-1 font-bold text-gray-900">אפשרויות גימור</h2>
        <p className="mb-3 text-sm text-gray-500">
          תוספות ליחידה שהמשתלה יכולה לבחור לכל מוצר שמאפשר גימור.
        </p>
        <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          {options.map((o) => (
            <PrintOptionForm
              key={o.id}
              option={{ id: o.id, optionName: o.optionName, extraPrice: o.extraPrice.toString() }}
            />
          ))}
          <div className="border-t border-gray-100 pt-3">
            <PrintOptionForm />
          </div>
        </div>
      </section>
    </div>
  );
}
