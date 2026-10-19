'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createZone, updateZonePostcodes, type ShippingZoneState } from './actions';

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
  const [state, action] = useActionState(createZone, initial);
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">שם האזור</span>
          <input name="name" required defaultValue={v.name} placeholder='למשל "מרכז הארץ"' className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מחיר משלוח (₪)</span>
          <input name="shippingPrice" type="number" min="0" step="0.5" required defaultValue={v.shippingPrice} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">משלוח חינם מעל (₪)</span>
          <input
            name="freeShippingThreshold"
            defaultValue={v.freeShippingThreshold}
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
          defaultValue={v.cities}
          placeholder={'תל אביב\nרמת גן\nגבעתיים'}
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">מיקודים (לא חובה) — מיקוד מלא או התחלה, שורה לכל אחד</span>
        <textarea name="postcodes" rows={2} dir="ltr" defaultValue={v.postcodes} placeholder={'52\n5250000'} aria-label="מיקודים לאזור חדש" className={field} />
        <span className="mt-1 block text-xs text-gray-500">מיקוד הלקוח שתואם גובר על העיר; &quot;52&quot; מכסה כל מיקוד שמתחיל ב-52.</span>
      </label>
      <div className="flex items-center gap-3">
        <Submit />
        {state.ok && <span className="text-sm text-green-700">נוסף ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}


/** עריכת המיקודים של אזור קיים. */
export function ZonePostcodesForm({ id, postcodes, name }: { id: string; postcodes: string[]; name: string }) {
  const [state, action] = useActionState(updateZonePostcodes, initial);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="postcodes"
        dir="ltr"
        defaultValue={state.values?.postcodes ?? postcodes.join(', ')}
        placeholder="מיקודים, מופרדים בפסיק"
        aria-label={`מיקודים — ${name}`}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs"
      />
      <button className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">שמירת מיקודים</button>
      {state.ok && <span className="text-xs text-green-700">נשמר ✓</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
