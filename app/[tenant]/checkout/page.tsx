'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/cart/cart-provider';
import { formatPrice } from '@/lib/utils';
import { createOrder } from './actions';

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const { items, subtotal, clear } = useCart();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div dir="rtl" className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">העגלה ריקה</h1>
        <Link href="/catalog" className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700">
          למעבר לקטלוג
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);

    const res = await createOrder({
      tenant: params.tenant,
      customerName: String(fd.get('customerName') || ''),
      customerEmail: String(fd.get('customerEmail') || ''),
      customerPhone: String(fd.get('customerPhone') || ''),
      shippingAddress: String(fd.get('shippingAddress') || ''),
      couponCode: String(fd.get('couponCode') || ''),
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    if (res.ok && res.orderId) {
      clear();
      router.push(`/checkout/success/${res.orderId}`);
      return;
    }
    setError(res.error ?? 'שגיאה');
    setPending(false);
  }

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">סיום הזמנה</h1>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">שם מלא *</span>
              <input name="customerName" required className={field} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">טלפון *</span>
              <input name="customerPhone" required inputMode="tel" className={field} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">אימייל *</span>
            <input name="customerEmail" type="email" required className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">כתובת למשלוח</span>
            <textarea name="shippingAddress" rows={2} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">קוד קופון</span>
            <input name="couponCode" className={field} />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--brand,#16a34a)] py-3 font-medium text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? 'שולח הזמנה...' : 'שליחת הזמנה'}
          </button>
          <p className="text-center text-xs text-gray-400">
            התשלום מתבצע מול המשתלה לאחר יצירת ההזמנה.
          </p>
        </form>

        <aside className="h-fit rounded-xl border border-gray-100 bg-gray-50 p-5">
          <h2 className="mb-3 font-bold text-gray-900">סיכום</h2>
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-gray-600">
                  {i.title} × {i.quantity}
                </span>
                <span className="shrink-0 text-gray-900">{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-gray-200 pt-3 font-bold">
            <span>סה"כ ביניים</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">הנחות קופון יחושבו בעת שליחת ההזמנה.</p>
        </aside>
      </div>
    </div>
  );
}
