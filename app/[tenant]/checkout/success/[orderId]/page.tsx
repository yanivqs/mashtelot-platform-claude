import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { formatPrice } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'ההזמנה התקבלה',
  robots: { index: false, follow: false },
};

export default async function OrderSuccessPage({
  params,
}: {
  params: { tenant: string; orderId: string };
}) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, nurseryId: nursery.id },
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-14 w-14 text-brand-600" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">ההזמנה התקבלה!</h1>
        <p className="mt-2 text-gray-600">
          תודה {order.customerName}. שלחנו אישור לכתובת {order.customerEmail}.
          <br />
          המשתלה תיצור איתך קשר בטלפון {order.customerPhone} לתיאום תשלום ואיסוף/משלוח.
        </p>
        <p className="mt-3 text-sm text-gray-400">מספר הזמנה: {order.id}</p>

        <ul className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-100 text-right">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-700">
                {item.productTitle} × {item.quantity}
              </span>
              <span className="text-gray-900">
                {formatPrice(Number(item.unitPrice) * item.quantity)}
              </span>
            </li>
          ))}
          <li className="flex justify-between px-4 py-3 font-bold">
            <span>סה"כ</span>
            <span>{formatPrice(order.totalAmount.toString())}</span>
          </li>
        </ul>

        <Link
          href="/catalog"
          className="mt-8 inline-block rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
        >
          המשך לעיין בקטלוג
        </Link>
      </div>
    </div>
  );
}
