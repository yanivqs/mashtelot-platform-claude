'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { importRedirectsAction, saveRedirectAction, type RedirectFormState } from './actions';

const initial: RedirectFormState = {};
const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AddRedirectForm() {
  const [state, action] = useActionState(saveRedirectAction, initial);
  const keep = !state.ok;
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">כתובת ישנה</span>
          <input
            name="from"
            dir="ltr"
            key={`from-${state.ok ? 'r' : 'k'}`}
            defaultValue={keep ? state.from : ''}
            placeholder="/shop/roses או https://old-site.co.il/about.html"
            className={field}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">יעד בחנות</span>
          <input
            name="to"
            dir="ltr"
            key={`to-${state.ok ? 'r' : 'k'}`}
            defaultValue={keep ? state.to : ''}
            placeholder="/catalog"
            className={field}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Submit label="הוספת הפניה" pending="שומר..." />
        {state.message && <span className="text-sm text-green-700">{state.message}</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function ImportRedirectsForm() {
  const [state, action] = useActionState(importRedirectsAction, initial);
  return (
    <form action={action} className="space-y-3">
      <textarea
        name="csv"
        dir="ltr"
        rows={5}
        key={state.csv === '' ? 'reset' : 'keep'}
        defaultValue={state.csv}
        placeholder={'from,to\n/old-page.html,/about\n/shop/roses,/catalog?category=roses'}
        aria-label="שורות הפניה בפורמט CSV"
        className={`${field} font-mono`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <input name="file" type="file" accept=".csv,text/csv,text/plain" aria-label="קובץ CSV" className="text-sm" />
        <Submit label="יבוא" pending="מייבא..." />
      </div>
      {state.message && <p className={`text-sm ${state.ok ? 'text-green-700' : 'text-red-600'}`}>{state.message}</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.importErrors && state.importErrors.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">
          {state.importErrors.map((e) => (
            <li key={e.line}>
              שורה {e.line}: {e.error}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
