import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { getCustomer } from '@/lib/customer-session';
import { customerOrder } from '@/lib/customer-portal';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/order-state';
import { formatPrice } from '@/lib/utils';
import { lineTitle } from '@/lib/variants';
import { ReorderButton } from '../../portal-ui';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'פרטי הזמנה',
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'medium', timeStyle: 'short' });

/** פרטי הזמנה ללקוח — רק הזמנה שלו ובחנות הזו (אחרת 404, בלי לחשוף שהיא קיימת). */
export default async function CustomerOrderPage(props: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant, id } = await props.params;
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery || !(await isModuleEnabled(nursery.id, 'customer_accounts'))) notFound();
  const customer = await getCustomer(nursery.id);
  if (!customer) redirect('/account');
  const order = await customerOrder(prisma, nursery.id, customer.id, id);
  if (!order) notFound();
  const canReorder = await isModuleEnabled(nursery.id, 'loyalty');

  return (
    <div dir="rtl" className="mx-auto max-w-2xl space-y-5 px-6 py-10">
      <Link href="/account" className="text-sm text-gray-500 hover:underline">
        ← החשבון שלי
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">הזמנה #{order.id.slice(0, 8)}</h1>
        <p className="text-sm text-gray-500">{dateFmt.format(order.createdAt)}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-gray-100 px-3 py-1">סטטוס: {ORDER_STATUS_LABELS[order.status]}</span>
        <span className="rounded-full bg-gray-100 px-3 py-1">תשלום: {PAYMENT_STATUS_LABELS[order.paymentStatus]}</span>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <ul className="divide-y divide-gray-100 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {lineTitle(i.productTitle, i.variantName)} × {i.quantity}
              </span>
              <span>{formatPrice(Number(i.unitPrice) * i.quantity)}</span>
            </li>
          ))}
        </ul>
        {order.shippingCost !== null && Number(order.shippingCost) > 0 && (
          <p className="mt-2 flex justify-between text-sm text-gray-600">
            <span>משלוח</span>
            <span>{formatPrice(order.shippingCost.toString())}</span>
          </p>
        )}
        <p className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-bold">
          <span>סה״כ</span>
          <span>{formatPrice(order.totalAmount.toString())}</span>
        </p>
      </section>

      <section className="text-sm text-gray-700">
        {order.deliveryMethod === 'DELIVERY' ? `משלוח לכתובת: ${order.shippingAddress ?? '—'}` : 'איסוף עצמי מהמשתלה'}
      </section>

      {canReorder && <ReorderButton tenant={tenant} orderId={order.id} />}
    </div>
  );
}
