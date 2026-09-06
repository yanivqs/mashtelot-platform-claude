'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updatePrintOrderStatus, createPrintProduct, type PrintProductState } from './actions';

const STATUS: Array<[string, string]> = [
  ['NEW', 'התקבלה'],
  ['IN_PRODUCTION', 'בהפקה'],
  ['SHIPPED', 'נשלחה'],
  ['DELIVERED', 'נמסרה'],
  ['CANCELLED', 'בוטלה'],
];

export function PrintStatusSelect({ id, status }: { id: string; status: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={updatePrintOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => ref.current?.requestSubmit()}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500"
      >
        {STATUS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </form>
  );
}

const initial: PrintProductState = {};
const field = 'rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? '...' : 'הוספה'}
    </button>
  );
}

export function NewPrintProductForm() {
  const [state, action] = useFormState(createPrintProduct, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם מוצר</span>
        <input name="title" required className={`${field} w-56`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מחיר ליח׳</span>
        <input name="basePrice" type="number" step="0.01" min="0" required className={`${field} w-24`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מינ׳ כמות</span>
        <input name="minQuantity" type="number" min="1" defaultValue={1} className={`${field} w-20`} />
      </label>
      <label className="w-full text-sm sm:w-auto sm:flex-1">
        <span className="mb-1 block font-medium text-gray-700">תיאור</span>
        <input name="description" className={`${field} w-full`} />
      </label>
      <AddButton />
      {state.ok && <span className="text-sm text-green-700">נוסף ✓</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
