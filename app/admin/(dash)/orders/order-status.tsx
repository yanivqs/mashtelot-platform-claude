'use client';

import { useActionState, useRef } from 'react';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  allowedNextPaymentStatuses,
  allowedNextStatuses,
  normalizeStatus,
} from '@/lib/order-state';
import { updateOrderStatus, updatePaymentStatus, type OrderActionState } from './actions';

const initial: OrderActionState = {};
const select =
  'rounded-md border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-500';

/** מציג את הסטטוס הנוכחי ומאפשר רק את המעברים החוקיים ממנו. */
export function OrderStatusSelect({ id, status }: { id: string; status: OrderStatus }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(updateOrderStatus, initial);
  const current = normalizeStatus(status);
  const next = allowedNextStatuses(status);

  return (
    <form ref={formRef} action={action} className="text-left">
      <input type="hidden" name="id" value={id} />
      <select
        key={status}
        name="status"
        defaultValue=""
        disabled={next.length === 0}
        onChange={() => formRef.current?.requestSubmit()}
        className={select}
        aria-label="סטטוס הזמנה"
      >
        <option value="" disabled>
          {ORDER_STATUS_LABELS[current]}
        </option>
        {next.map((s) => (
          <option key={s} value={s}>
            → {ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {state.error && <p className="mt-1 max-w-56 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function PaymentStatusSelect({ id, status }: { id: string; status: PaymentStatus }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(updatePaymentStatus, initial);
  const next = allowedNextPaymentStatuses(status);

  return (
    <form ref={formRef} action={action} className="text-left">
      <input type="hidden" name="id" value={id} />
      <select
        key={status}
        name="paymentStatus"
        defaultValue=""
        disabled={next.length === 0}
        onChange={() => formRef.current?.requestSubmit()}
        className={select}
        aria-label="סטטוס תשלום"
      >
        <option value="" disabled>
          {PAYMENT_STATUS_LABELS[status]}
        </option>
        {next.map((s) => (
          <option key={s} value={s}>
            → {PAYMENT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {state.error && <p className="mt-1 max-w-56 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
