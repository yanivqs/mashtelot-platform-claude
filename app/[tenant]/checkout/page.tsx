'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { PaymentMethod } from '@prisma/client';
import { useCart } from '@/components/cart/cart-provider';
import { formatPrice } from '@/lib/utils';
import { createOrder, getCheckoutPaymentMethods, getCheckoutShippingCities } from './actions';
import type { EnabledPaymentMethod } from '@/lib/payment-methods';

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const tenant = params?.tenant ?? '';
  const { items, subtotal, clear, salesMode } = useCart();
  const isQuote = salesMode === 'QUOTE';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<EnabledPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | ''>('');
  const [shippingCities, setShippingCities] = useState<string[]>([]);

  useEffect(() => {
    if (isQuote) return;
    getCheckoutPaymentMethods(tenant).then(setPaymentMethods);
    getCheckoutShippingCities(tenant).then(setShippingCities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, isQuote]);

  if (salesMode === 'DISABLED' || items.length === 0) {
    return (
      <div dir="rtl" className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {salesMode === 'DISABLED' ? 'לא ניתן להזמין כרגע' : 'העגלה ריקה'}
        </h1>
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
      tenant,
      customerName: String(fd.get('customerName') || ''),
      customerEmail: String(fd.get('customerEmail') || ''),
      customerPhone: String(fd.get('customerPhone') || ''),
      shippingAddress: String(fd.get('shippingAddress') || ''),
      city: String(fd.get('city') || ''),
      couponCode: String(fd.get('couponCode') || ''),
      paymentMethod: selectedMethod || undefined,
      paymentReference: String(fd.get('paymentReference') || ''),
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
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {isQuote ? 'בקשת הצעת מחיר' : 'סיום הזמנה'}
      </h1>

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
          {!isQuote && shippingCities.length > 0 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">עיר למשלוח *</span>
              <select name="city" required defaultValue="" className={field}>
                <option value="" disabled>
                  בחרו עיר...
                </option>
                {shippingCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">כתובת למשלוח (רחוב ומספר)</span>
            <textarea name="shippingAddress" rows={2} className={field} />
          </label>
          {!isQuote && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">קוד קופון</span>
              <input name="couponCode" className={field} />
            </label>
          )}

          {!isQuote && paymentMethods.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-4">
              <span className="mb-2 block text-sm font-medium text-gray-700">אופן התשלום</span>
              <div className="space-y-2">
                {paymentMethods.map((m) => (
                  <label key={m.method} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="paymentMethodChoice"
                      checked={selectedMethod === m.method}
                      onChange={() => setSelectedMethod(m.method)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              {selectedMethod && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {(() => {
                    const m = paymentMethods.find((x) => x.method === selectedMethod);
                    if (!m) return null;
                    return (
                      <>
                        {(m.destination || m.instructions) && (
                          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                            {m.instructions}
                            {m.instructions && m.destination ? ' · ' : ''}
                            {m.destination}
                          </p>
                        )}
                        <label className="block text-sm">
                          <span className="mb-1 block font-medium text-gray-700">
                            אסמכתא / הערה לתשלום
                          </span>
                          <input name="paymentReference" className={field} />
                        </label>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--brand,#16a34a)] py-3 font-medium text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {pending
              ? isQuote
                ? 'שולח בקשה...'
                : 'שולח הזמנה...'
              : isQuote
                ? 'שליחת בקשת הצעת מחיר'
                : 'שליחת הזמנה'}
          </button>
          <p className="text-center text-xs text-gray-400">
            {isQuote
              ? 'המשתלה תחזור אליכם עם הצעת מחיר מפורטת. אין חיוב בשלב זה.'
              : 'התשלום מתבצע מול המשתלה לאחר יצירת ההזמנה.'}
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
            <span>{isQuote ? 'הערכת מחיר' : 'סה"כ ביניים'}</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {isQuote
              ? 'המחיר הסופי ייקבע בהצעת המחיר.'
              : 'הנחות קופון ועלות משלוח יחושבו בעת שליחת ההזמנה.'}
          </p>
        </aside>
      </div>
    </div>
  );
}
