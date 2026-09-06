'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useCart } from '@/components/cart/cart-provider';
import { formatPrice } from '@/lib/utils';

export default function CartPage() {
  const { items, subtotal, setQuantity, remove, clear } = useCart();

  if (items.length === 0) {
    return (
      <div dir="rtl" className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">העגלה ריקה</h1>
        <p className="mt-2 text-gray-500">עדיין לא הוספתם מוצרים לעגלה.</p>
        <Link
          href="/catalog"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
        >
          למעבר לקטלוג
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">עגלת קניות</h1>
        <button onClick={clear} className="text-sm text-gray-500 hover:text-red-600">
          רוקן עגלה
        </button>
      </div>

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 p-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-2xl">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden>🪴</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={`/product/${item.slug}`}
                className="block truncate font-medium text-gray-900 hover:text-brand-700"
              >
                {item.title}
              </Link>
              <p className="text-sm text-gray-500">{formatPrice(item.price)} ליחידה</p>
            </div>

            <div className="flex items-center rounded-lg border border-gray-200">
              <button
                aria-label="הפחת"
                className="px-2.5 py-1.5 text-gray-500 hover:text-gray-900"
                onClick={() => setQuantity(item.productId, item.quantity - 1)}
              >
                −
              </button>
              <span className="w-8 text-center text-sm">{item.quantity}</span>
              <button
                aria-label="הוסף"
                className="px-2.5 py-1.5 text-gray-500 hover:text-gray-900"
                onClick={() => setQuantity(item.productId, item.quantity + 1)}
              >
                +
              </button>
            </div>

            <div className="w-20 text-left text-sm font-medium text-gray-900">
              {formatPrice(item.price * item.quantity)}
            </div>

            <button
              aria-label="הסר מהעגלה"
              onClick={() => remove(item.productId)}
              className="text-gray-400 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between rounded-xl bg-gray-50 p-5">
        <span className="text-lg font-medium text-gray-700">סה"כ ביניים</span>
        <span className="text-2xl font-bold text-gray-900">{formatPrice(subtotal)}</span>
      </div>

      <button
        className="mt-4 w-full rounded-lg bg-[var(--brand,#16a34a)] py-3.5 font-medium text-white transition hover:brightness-95"
        onClick={() => alert('תהליך התשלום ייושם בשלב הבא (שלב 5).')}
      >
        המשך לתשלום
      </button>
    </div>
  );
}
