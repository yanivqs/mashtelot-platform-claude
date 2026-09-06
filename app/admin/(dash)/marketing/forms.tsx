'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createCoupon, createPromotion, type MarketingState } from './actions';

const initial: MarketingState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : label}
    </button>
  );
}

export function CouponForm() {
  const [state, action] = useFormState(createCoupon, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קוד</span>
        <input name="code" required placeholder="SPRING10" className={`${field} w-40`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">אחוז הנחה</span>
        <input name="discountPct" type="number" min="1" max="100" required className={`${field} w-28`} />
      </label>
      <Submit label="הוספת קופון" />
      {state.ok && <span className="text-sm text-green-700">נוסף ✓</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}

export function PromotionForm() {
  const [state, action] = useFormState(createPromotion, initial);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">כותרת (פנימי)</span>
        <input name="title" required className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">טקסט הפופאפ (מוצג ללקוח)</span>
        <textarea name="popupText" rows={2} required className={field} />
      </label>
      <div className="flex items-center gap-3">
        <Submit label="הוספת פופאפ" />
        {state.ok && <span className="text-sm text-green-700">נוסף ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
