'use client';

import { useRef } from 'react';
import { updateOrderStatus } from './actions';

const OPTIONS: Array<[string, string]> = [
  ['PENDING', 'ממתין'],
  ['PAID', 'שולם'],
  ['PROCESSING', 'בטיפול'],
  ['SHIPPED', 'נשלח'],
  ['DELIVERED', 'נמסר'],
  ['CANCELLED', 'בוטל'],
];

export function OrderStatusSelect({ id, status }: { id: string; status: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500"
      >
        {OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
