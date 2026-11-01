'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { useCart } from '@/components/cart/cart-provider';
import { readRecent } from '@/components/storefront/product-personal';
import { formatPrice } from '@/lib/utils';
import { addAddressAction, productSummaries, reorderAction, type AddressState, type ProductSummary } from './portal-actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand,#16a34a)]';

export function ProductGrid({ items, empty }: { items: ProductSummary[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-gray-600">{empty}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={`/product/${p.slug}`} className="block rounded-lg border border-gray-100 p-2 hover:border-gray-200">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={p.title} className="mb-2 aspect-square w-full rounded-md object-cover" />
            ) : (
              <div className="mb-2 aspect-square w-full rounded-md bg-gray-50" />
            )}
            <p className="line-clamp-2 text-sm font-medium text-gray-900">{p.title}</p>
            <p className="text-xs text-gray-600">
              {p.fromPrice ? 'החל מ-' : ''}
              {formatPrice(p.price)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** נצפו לאחרונה — המזהים מהדפדפן, הפרטים מהשרת (רק מוצרים פעילים של החנות הזו). */
export function RecentProducts({ tenant }: { tenant: string }) {
  const [items, setItems] = useState<ProductSummary[] | null>(null);
  useEffect(() => {
    productSummaries(tenant, readRecent()).then(setItems);
  }, [tenant]);
  if (items === null) return null;
  return <ProductGrid items={items} empty="עוד לא צפיתם במוצרים." />;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-[var(--brand,#16a34a)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60">
      {pending ? '...' : label}
    </button>
  );
}

export function AddAddressForm({ tenant }: { tenant: string }) {
  const [state, action] = useActionState(addAddressAction, {} as AddressState);
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenant" value={tenant} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">עיר *</span>
          <input name="city" required defaultValue={v.city} autoComplete="address-level2" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">רחוב, מספר ודירה *</span>
          <input name="street" required defaultValue={v.street} autoComplete="street-address" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">מיקוד</span>
          <input name="postcode" defaultValue={v.postcode} inputMode="numeric" autoComplete="postal-code" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">כינוי (בית, עבודה...)</span>
          <input name="label" defaultValue={v.label} className={field} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input name="isDefault" type="checkbox" className="h-4 w-4" /> כתובת ברירת מחדל
      </label>
      <div className="flex items-center gap-3">
        <Submit label="שמירת כתובת" />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

/** "הזמן שוב": הפריטים הזמינים נכנסים לעגלה במחיר של היום. */
export function ReorderButton({ tenant, orderId }: { tenant: string; orderId: string }) {
  const { add } = useCart();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await reorderAction(tenant, orderId);
          setBusy(false);
          if (!r.ok || !r.lines) return setMsg(r.error ?? 'שגיאה');
          for (const l of r.lines) add({ productId: l.productId, variantId: l.variantId, title: l.title, price: l.price, image: l.image, slug: l.slug }, l.quantity);
          if (r.lines.length === 0) return setMsg('אף פריט מההזמנה אינו זמין כעת.');
          // חלק מהפריטים לא זמינים — נשארים כאן כדי שההודעה תיראה
          if (r.skipped?.length) return setMsg(`הפריטים הזמינים נוספו לעגלה. לא זמינים כעת: ${r.skipped.join(', ')}`);
          router.push('/cart');
        }}
        className="rounded-lg bg-[var(--brand,#16a34a)] px-4 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60"
      >
        {busy ? '...' : 'הזמן שוב'}
      </button>
      <p className="text-xs text-gray-600">הפריטים הזמינים יתווספו לעגלה במחיר של היום.</p>
      {msg && (
        <p className="text-sm text-amber-800">
          {msg}{' '}
          <Link href="/cart" className="font-medium underline">
            לעגלה
          </Link>
        </p>
      )}
    </div>
  );
}
