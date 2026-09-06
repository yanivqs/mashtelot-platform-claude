import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'ממתין',
  PAID: 'שולם',
  PROCESSING: 'בטיפול',
  SHIPPED: 'נשלח',
  DELIVERED: 'נמסר',
  CANCELLED: 'בוטל',
};

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
      <h1 className="mb-6 text-2xl font-bold">הזמנות</h1>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          אין הזמנות עדיין. תהליך התשלום ייושם בהמשך.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-right text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">תאריך</th>
                <th className="px-4 py-3 font-medium">לקוח</th>
                {user.role === 'SUPER_ADMIN' && <th className="px-4 py-3 font-medium">משתלה</th>}
                <th className="px-4 py-3 font-medium">פריטים</th>
                <th className="px-4 py-3 font-medium">סכום</th>
                <th className="px-4 py-3 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-gray-500">
                    {o.createdAt.toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-4 py-3">{o.customerName}</td>
                  {user.role === 'SUPER_ADMIN' && (
                    <td className="px-4 py-3 text-gray-500">{o.nursery.name}</td>
                  )}
                  <td className="px-4 py-3 text-gray-500">{o.items.length}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(o.totalAmount.toString())}</td>
                  <td className="px-4 py-3">{STATUS_LABEL[o.status] ?? o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
