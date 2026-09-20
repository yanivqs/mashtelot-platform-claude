'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { dryRunImport, type DryRunState } from './actions';

const initial: DryRunState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'מנתח קובץ...' : 'בדיקה (Dry Run)'}
    </button>
  );
}

export function UploadForm() {
  const [state, action] = useFormState(dryRunImport, initial);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">קובץ CSV</span>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-gray-700 file:me-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
      </label>
      <p className="text-xs text-gray-400">
        עמודות נדרשות: plant_id, hebrew_name. הקובץ לא ישנה כלום עדיין — זו רק בדיקה מקדימה.
      </p>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Submit />
    </form>
  );
}
