'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addSynonymGroup, updateSynonymGroup, type SynonymFormState } from './actions';

const initial: SynonymFormState = {};
const field =
  'min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

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

export function AddSynonymForm() {
  const [state, action] = useActionState(addSynonymGroup, initial);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          name="terms"
          // אחרי הצלחה — ריק; אחרי שגיאה — מה שהוקלד
          key={state.ok ? 'reset' : 'keep'}
          defaultValue={state.ok ? '' : state.value}
          placeholder="למשל: נענע, מנטה"
          aria-label="מונחים נרדפים, מופרדים בפסיק"
          className={field}
        />
        <Submit label="הוספת קבוצה" pending="מוסיף..." />
      </div>
      {state.ok && <p className="text-sm text-green-700">נוסף ✓</p>}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function EditSynonymForm({ id, terms }: { id: string; terms: string[] }) {
  const [state, action] = useActionState(updateSynonymGroup, initial);
  return (
    <form action={action} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="terms"
        defaultValue={state.value ?? terms.join(', ')}
        aria-label="מונחים נרדפים"
        className={field}
      />
      <Submit label="שמירה" pending="שומר..." />
      {state.ok && <span className="text-xs text-green-700">נשמר ✓</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
