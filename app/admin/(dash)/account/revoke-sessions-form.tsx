'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { revokeOtherSessionsAction, type RevokeSessionsState } from './actions';

const initial: RevokeSessionsState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? 'מנתק...' : 'נתק את כל המכשירים האחרים'}
    </button>
  );
}

export function RevokeSessionsForm() {
  const [state, action] = useActionState(revokeOtherSessionsAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton />
      {state.ok && <span className="text-sm text-green-700">כל המכשירים האחרים נותקו ✓</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
