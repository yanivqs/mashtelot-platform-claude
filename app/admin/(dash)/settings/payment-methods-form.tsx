'use client';

import { useActionState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import type { NurseryPaymentMethod } from '@prisma/client';
import { savePaymentMethods, type SavePaymentMethodsState } from './payment-actions';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_DESTINATION_LABELS } from '@/lib/payment-methods';

const HINTS: Partial<Record<string, string>> = {
  PAY_ON_PICKUP: 'מוצג ללקוח רק כשבחר איסוף עצמי.',
  PAY_ON_DELIVERY: 'מוצג ללקוח רק כשבחר משלוח.',
};

const initial: SavePaymentMethodsState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירת אפשרויות תשלום'}
    </button>
  );
}

export function PaymentMethodsForm({ methods }: { methods: NurseryPaymentMethod[] }) {
  const [state, action] = useActionState(savePaymentMethods, initial);
  const keep = useKeepFormValues(state);
  const byMethod = new Map(methods.map((m) => [m.method, m]));

  return (
    <form ref={keep} action={action} className="space-y-4">
      {PAYMENT_METHODS.map((method) => {
        const row = byMethod.get(method);
        const destLabel = PAYMENT_DESTINATION_LABELS[method];
        return (
          <div key={method} className="rounded-lg border border-gray-100 p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                name={`${method}_enabled`}
                defaultChecked={row?.isEnabled ?? false}
              />
              {PAYMENT_METHOD_LABELS[method]}
            </label>
            {HINTS[method] && <p className="mt-1 text-xs text-gray-500">{HINTS[method]}</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {destLabel && (
                <label className="text-sm">
                  <span className="mb-1 block text-gray-700">{destLabel}</span>
                  <input
                    name={`${method}_destination`}
                    defaultValue={row?.destination ?? ''}
                    dir={method === 'PAYPAL' ? 'ltr' : undefined}
                    placeholder={method === 'PAYPAL' ? 'https://paypal.me/your-name' : undefined}
                    className={field}
                  />
                </label>
              )}
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">הוראות ללקוח</span>
                <input
                  name={`${method}_instructions`}
                  defaultValue={row?.instructions ?? ''}
                  className={field}
                />
              </label>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <Submit />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
