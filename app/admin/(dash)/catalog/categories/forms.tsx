'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createCategory, type CategoryState } from './actions';

const initial: CategoryState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'הוספת קטגוריה'}
    </button>
  );
}

export function CategoryForm() {
  const [state, action] = useFormState(createCategory, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם קטגוריה</span>
        <input name="name" required placeholder='למשל "עצי נוי"' className={`${field} w-56`} />
      </label>
      <Submit />
      {state.ok && <span className="text-sm text-green-700">נוספה ✓</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
