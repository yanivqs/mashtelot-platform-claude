'use client';

import { useActionState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { saveDeliverySettings, type SaveDeliveryState } from './delivery-actions';

const initial: SaveDeliveryState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'שומר...' : 'שמירה'}
    </button>
  );
}

export function DeliveryForm({
  pickupEnabled,
  deliveryEnabled,
  deliveryNote,
  showZonesLink,
}: {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryNote: string | null;
  showZonesLink: boolean;
}) {
  const [state, action] = useActionState(saveDeliverySettings, initial);
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="pickupEnabled" defaultChecked={pickupEnabled} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="block font-medium text-gray-800">איסוף עצמי מהמשתלה</span>
          <span className="text-xs text-gray-500">ללא עלות. כתובת המשתלה (מפרטי יצירת הקשר) מוצגת ללקוח.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="deliveryEnabled" defaultChecked={deliveryEnabled} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="block font-medium text-gray-800">משלוח עד הבית</span>
          <span className="text-xs text-gray-500">
            ללא אזורי משלוח מוגדרים — הלקוח מזין עיר וכתובת, והעלות מתואמת מולו.
            {showZonesLink && (
              <>
                {' '}
                <Link href="/admin/shipping" className="font-medium text-brand-700 hover:underline">
                  הגדרת עלויות לפי עיר
                </Link>
              </>
            )}
          </span>
        </span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">הערה ללקוח על משלוחים (אופציונלי)</span>
        <input
          name="deliveryNote"
          defaultValue={deliveryNote ?? ''}
          maxLength={300}
          placeholder="למשל: משלוחים בימים א׳-ה׳, תוך 2-4 ימי עסקים"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
      </label>
      <div className="flex items-center gap-3">
        <SaveButton />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
