'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { NurseryPaymentMethod } from '@prisma/client';
import { savePaymentMethods, type SavePaymentMethodsState } from './payment-actions';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/payment-methods';

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
  const [state, action] = useFormState(savePaymentMethods, initial);
  const byMethod = new Map(methods.map((m) => [m.method, m]));

  return (
    <form action={action} className="space-y-4">
      {PAYMENT_METHODS.map((method) => {
        const row = byMethod.get(method);
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
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">פרטי יעד (מספר טלפון / IBAN)</span>
                <input
                  name={`${method}_destination`}
                  defaultValue={row?.destination ?? ''}
                  className={field}
                />
              </label>
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
