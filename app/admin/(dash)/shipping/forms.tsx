'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createZone, type ShippingZoneState } from './actions';

const initial: ShippingZoneState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'הוספת אזור משלוח'}
    </button>
  );
}

export function ZoneForm() {
  const [state, action] = useFormState(createZone, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">שם האזור</span>
          <input name="name" required placeholder='למשל "מרכז הארץ"' className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מחיר משלוח (₪)</span>
          <input name="shippingPrice" type="number" min="0" step="0.5" required className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">משלוח חינם מעל (₪)</span>
          <input
            name="freeShippingThreshold"
            type="number"
            min="0"
            step="0.5"
            placeholder="ללא"
            className={field}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">ערים (שורה לכל עיר)</span>
        <textarea
          name="cities"
          rows={4}
          required
          placeholder={'תל אביב\nרמת גן\nגבעתיים'}
          className={field}
        />
      </label>
      <div className="flex items-center gap-3">
        <Submit />
        {state.ok && <span className="text-sm text-green-700">נוסף ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
