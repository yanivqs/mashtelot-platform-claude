'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Store, Truck } from 'lucide-react';
import type { PaymentMethod } from '@prisma/client';
import { cartKey, useCart } from '@/components/cart/cart-provider';
import { formatPrice } from '@/lib/utils';
import { resolveShippingCost, type DeliveryChoice } from '@/lib/checkout-calc';
import { isMethodAllowedFor, isPayOnSite } from '@/lib/payment-methods';
import { createOrder, getCheckoutOptions, type CheckoutOptions } from './actions';

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

const DELIVERY_LABELS: Record<DeliveryChoice, { title: string; Icon: typeof Store }> = {
  PICKUP: { title: 'איסוף עצמי מהמשתלה', Icon: Store },
  DELIVERY: { title: 'משלוח עד הבית', Icon: Truck },
};

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const tenant = params?.tenant ?? '';
  const { items, subtotal, clear, salesMode } = useCart();
  const isQuote = salesMode === 'QUOTE';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | ''>('');
  const [delivery, setDelivery] = useState<DeliveryChoice | ''>('');
  const [city, setCity] = useState('');
  // מפתח קבוע לניסיון ה-checkout הזה: לחיצה כפולה / ניסיון חוזר מחזירים את אותה הזמנה (C-P1-02)
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    getCheckoutOptions(tenant).then((o) => {
      setOptions(o);
      if (o?.deliveryMethods.length === 1) setDelivery(o.deliveryMethods[0]);
    });
  }, [tenant]);

  const zones = useMemo(() => options?.zones ?? [], [options]);
  const zoneCities = useMemo(() => zones.flatMap((z) => z.cities), [zones]);

  /** עלות המשלוח המשוערת (לפני קופון): null = תתואם / לא רלוונטי */
  const shippingEstimate = useMemo(() => {
    if (isQuote || delivery !== 'DELIVERY' || zones.length === 0 || !city) return null;
    const zone = zones.find((z) => z.cities.includes(city));
    return zone ? resolveShippingCost(subtotal, zone) : null;
  }, [isQuote, delivery, zones, city, subtotal]);

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
    if (!delivery) {
      setError('יש לבחור איסוף עצמי או משלוח');
      return;
    }
    setPending(true);
    const fd = new FormData(e.currentTarget);

    const res = await createOrder({
      tenant,
      customerName: String(fd.get('customerName') || ''),
      customerEmail: String(fd.get('customerEmail') || ''),
      customerPhone: String(fd.get('customerPhone') || ''),
      deliveryMethod: delivery,
      shippingAddress: String(fd.get('shippingAddress') || ''),
      city,
      couponCode: String(fd.get('couponCode') || ''),
      paymentMethod: effectiveMethod || undefined,
      paymentReference: String(fd.get('paymentReference') || ''),
      items: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
      idempotencyKey,
    });

    if (res.ok && res.orderId) {
      clear();
      router.push(`/checkout/success/${res.orderId}`);
      return;
    }
    setError(res.error ?? 'שגיאה');
    setPending(false);
  }

  // "תשלום באיסוף" רק באיסוף, "תשלום לשליח" רק במשלוח (גם נאכף בשרת)
  const paymentMethods = (isQuote ? [] : options?.paymentMethods ?? []).filter((m) =>
    isMethodAllowedFor(m.method, delivery),
  );
  const effectiveMethod = paymentMethods.some((m) => m.method === selectedMethod) ? selectedMethod : '';

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {isQuote ? 'בקשת הצעת מחיר' : 'סיום הזמנה'}
      </h1>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <h2 className="font-bold text-gray-900">פרטי התקשרות</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">שם מלא *</span>
                <input name="customerName" required autoComplete="name" className={field} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">טלפון *</span>
                <input name="customerPhone" required inputMode="tel" autoComplete="tel" className={field} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">אימייל *</span>
              <input name="customerEmail" type="email" required autoComplete="email" className={field} />
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-gray-900">אופן קבלת ההזמנה *</h2>
            {!options ? (
              <p className="text-sm text-gray-400">טוען אפשרויות...</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {options.deliveryMethods.map((m) => {
                  const { title, Icon } = DELIVERY_LABELS[m];
                  const active = delivery === m;
                  return (
                    <label
                      key={m}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                        active
                          ? 'border-[var(--brand,#16a34a)] bg-brand-50/40 ring-1 ring-[var(--brand,#16a34a)]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        className="mt-1"
                        checked={active}
                        onChange={() => setDelivery(m)}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium text-gray-900">
                          <Icon className="h-4 w-4" />
                          {title}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {m === 'PICKUP'
                            ? options.pickupAddress
                              ? `ללא עלות · ${options.pickupAddress}`
                              : 'ללא עלות'
                            : zones.length > 0
                              ? 'העלות לפי עיר המשלוח'
                              : 'עלות המשלוח תתואם מול המשתלה'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {delivery === 'DELIVERY' && (
              <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                {options?.deliveryNote && (
                  <p className="text-xs text-gray-600">{options.deliveryNote}</p>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">עיר / יישוב *</span>
                  {zoneCities.length > 0 ? (
                    <select
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={`${field} bg-white`}
                    >
                      <option value="" disabled>
                        בחרו עיר...
                      </option>
                      {zoneCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      autoComplete="address-level2"
                      className={`${field} bg-white`}
                    />
                  )}
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">רחוב, מספר בית ודירה *</span>
                  <input
                    name="shippingAddress"
                    required
                    autoComplete="street-address"
                    className={`${field} bg-white`}
                  />
                </label>
                {zoneCities.length > 0 && (
                  <p className="text-xs text-gray-500">
                    העיר שלכם לא ברשימה? צרו קשר עם המשתלה לתיאום משלוח.
                  </p>
                )}
              </div>
            )}
          </section>

          {!isQuote && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">קוד קופון</span>
              <input name="couponCode" className={field} />
            </label>
          )}

          {paymentMethods.length > 0 && (
            <div className="rounded-lg border border-gray-200 p-4">
              <span className="mb-2 block text-sm font-medium text-gray-700">אופן התשלום</span>
              <div className="space-y-2">
                {paymentMethods.map((m) => (
                  <label key={m.method} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="paymentMethodChoice"
                      checked={effectiveMethod === m.method}
                      onChange={() => setSelectedMethod(m.method)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
              {effectiveMethod && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {(() => {
                    const m = paymentMethods.find((x) => x.method === effectiveMethod);
                    if (!m) return null;
                    return (
                      <>
                        {(m.destination || m.instructions) && (
                          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
                            {m.instructions}
                            {m.instructions && m.destination ? ' · ' : ''}
                            {m.method === 'PAYPAL' && m.destination ? (
                              <a
                                href={m.destination}
                                target="_blank"
                                rel="noopener noreferrer"
                                dir="ltr"
                                className="font-medium underline"
                              >
                                {m.destination}
                              </a>
                            ) : (
                              m.destination
                            )}
                          </p>
                        )}
                        {!isPayOnSite(m.method) && (
                          <label className="block text-sm">
                            <span className="mb-1 block font-medium text-gray-700">
                              אסמכתא / הערה לתשלום
                            </span>
                            <input name="paymentReference" className={field} />
                          </label>
                        )}
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
            disabled={pending || !options}
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
              <li key={cartKey(i)} className="flex justify-between gap-2">
                <span className="min-w-0 truncate text-gray-600">
                  {i.title} × {i.quantity}
                </span>
                <span className="shrink-0 text-gray-900">{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-gray-200 pt-3 text-sm">
            <span className="text-gray-600">{isQuote ? 'הערכת מחיר' : 'סה"כ מוצרים'}</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {delivery && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-gray-600">{delivery === 'PICKUP' ? 'איסוף עצמי' : 'משלוח'}</span>
              <span>
                {delivery === 'PICKUP'
                  ? 'חינם'
                  : shippingEstimate === null
                    ? zones.length > 0 && !isQuote
                      ? 'בחרו עיר'
                      : 'יתואם'
                    : shippingEstimate === 0
                      ? 'חינם'
                      : formatPrice(shippingEstimate)}
              </span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-bold">
            <span>{isQuote ? 'סה"כ משוער' : 'סה"כ לתשלום'}</span>
            <span>{formatPrice(subtotal + (shippingEstimate ?? 0))}</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            {isQuote
              ? 'המחיר הסופי ייקבע בהצעת המחיר.'
              : 'הנחת קופון (אם הוזן) תחושב בעת שליחת ההזמנה.'}
          </p>
        </aside>
      </div>
    </div>
  );
}
