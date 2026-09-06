import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { OrderStatusSelect } from './order-status';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  const where = user.role === 'SUPER_ADMIN' ? {} : { nurseryId: user.nurseryId ?? '__none__' };

  const orders = await prisma.order.findMany({
    where,
    include: { items: true, nursery: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">הזמנות</h1>
      <p className="mb-6 text-sm text-gray-500">{orders.length} הזמנות</p>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          אין הזמנות עדיין.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{o.customerName}</p>
                  <p className="text-sm text-gray-500">
                    {o.customerPhone} · {o.customerEmail}
                  </p>
                  {o.shippingAddress && (
                    <p className="text-sm text-gray-500">משלוח: {o.shippingAddress}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {o.createdAt.toLocaleString('he-IL')}
                    {user.role === 'SUPER_ADMIN' ? ` · ${o.nursery.name}` : ''}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(o.totalAmount.toString())}
                  </p>
                  <div className="mt-1">
                    <OrderStatusSelect id={o.id} status={o.status} />
                  </div>
                </div>
              </div>

              <ul className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                {o.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-0.5">
                    <span>
                      {item.productTitle} × {item.quantity}
                    </span>
                    <span>{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
