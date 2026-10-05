'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createNurseryCategory, type NurseryCategoryState } from './actions';

const initial: NurseryCategoryState = {};
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

export function NurseryCategoryForm({
  options,
}: {
  options: Array<{ id: string; name: string; depth: number }>;
}) {
  const [state, action] = useFormState(createNurseryCategory, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם קטגוריה</span>
        <input name="name" required placeholder='למשל "סוקולנטים"' className={`${field} w-56`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">תת-קטגוריה של</span>
        <select name="parentId" defaultValue="" className={`${field} w-56`}>
          <option value="">(קטגוריה ראשית)</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {'    '.repeat(o.depth)}
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <Submit />
      {state.ok && <span className="text-sm text-green-700">נוספה ✓</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
