import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment-methods';
import { releaseExpiredReservations } from '@/lib/order-service';
import { OrderStatusSelect, PaymentStatusSelect } from './order-status';

function StockBadge({ state, expiresAt }: { state: string; expiresAt: Date | null }) {
  if (state === 'RESERVED') {
    return (
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800">
        {expiresAt
          ? `מלאי שמור עד ${expiresAt.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}`
          : 'מלאי שמור'}
      </span>
    );
  }
  if (state === 'RELEASED') {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
        המלאי שוחרר — אישור ינסה לשמור מחדש
      </span>
    );
  }
  if (state === 'COMMITTED') {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">ירד מהמלאי</span>;
  }
  return null;
}

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  // הזמנות ופרטי לקוחות — לבעל המשתלה בלבד (אפיון §15.05); סופר-אדמין אינו רואה אותם
  const { nurseryId } = await requireNurseryPage({ all: ['orders'] });
  const where = { nurseryId };
  // שמירות שפגו (48 שעות ללא אישור) משוחררות לפני התצוגה — ההזמנה עצמה נשארת פתוחה
  await releaseExpiredReservations(prisma, { nurseryId });

  const orders = await prisma.order.findMany({
    where,
    include: { items: true, shippingZone: true },
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
                  <p className="flex items-center gap-2 font-medium text-gray-900">
                    {o.customerName}
                    {o.status === 'QUOTE_REQUESTED' && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        בקשת הצעת מחיר
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {o.customerPhone} · {o.customerEmail}
                  </p>
                  {o.deliveryMethod === 'PICKUP' && (
                    <p className="text-sm font-medium text-gray-700">איסוף עצמי מהמשתלה</p>
                  )}
                  {(o.deliveryMethod === 'DELIVERY' || (!o.deliveryMethod && o.shippingAddress)) && (
                    <p className="text-sm text-gray-500">
                      <span className="font-medium text-gray-700">משלוח</span>
                      {o.shippingAddress ? `: ${o.shippingAddress}` : ''}
                      {o.deliveryMethod === 'DELIVERY' && !o.shippingZone && ' · עלות לתיאום'}
                    </p>
                  )}
                  {o.paymentMethod && (
                    <p className="text-sm text-gray-500">
                      תשלום: {PAYMENT_METHOD_LABELS[o.paymentMethod]}
                      {o.paymentReference ? ` · אסמכתא: ${o.paymentReference}` : ''}
                    </p>
                  )}
                  {o.shippingZone && (
                    <p className="text-sm text-gray-500">
                      אזור משלוח: {o.shippingZone.name}
                      {o.shippingCost !== null
                        ? ` · ${formatPrice(o.shippingCost.toString())}`
                        : ''}
                    </p>
                  )}
                  {(o.groupDiscountAmount !== null || o.loyaltyDiscount !== null) && (
                    <p className="text-sm text-gray-500">
                      {o.groupDiscountAmount !== null ? `הנחת קבוצה ${Number(o.groupDiscountPct)}% · ${formatPrice(o.groupDiscountAmount.toString())}` : ''}
                      {o.groupDiscountAmount !== null && o.loyaltyDiscount !== null ? ' · ' : ''}
                      {o.loyaltyDiscount !== null ? `מימוש ${o.loyaltyPointsUsed} נקודות · ${formatPrice(o.loyaltyDiscount.toString())}` : ''}
                    </p>
                  )}
                  {o.couponCode && (
                    <p className="text-sm text-gray-500">
                      קופון {o.couponCode}
                      {o.discountAmount !== null ? ` · הנחה ${formatPrice(o.discountAmount.toString())}` : ''}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {o.createdAt.toLocaleString('he-IL')}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(o.totalAmount.toString())}
                  </p>
                  <div className="mt-1">
                    <OrderStatusSelect id={o.id} status={o.status} />
                  </div>
                  <div className="mt-1">
                    <PaymentStatusSelect id={o.id} status={o.paymentStatus} />
                  </div>
                  <div className="mt-1">
                    <StockBadge state={o.stockState} expiresAt={o.reservationExpiresAt} />
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
