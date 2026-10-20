'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { verifyMfaLogin, type MfaLoginState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60">
      {pending ? 'מאמת...' : 'אימות'}
    </button>
  );
}

export function MfaCodeForm() {
  const [state, action] = useActionState(verifyMfaLogin, {} as MfaLoginState);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="code" className="mb-1 block text-sm font-medium text-gray-700">
          קוד אימות
        </label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="text"
          dir="ltr"
          maxLength={16}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-center font-mono text-lg tracking-widest outline-none focus:border-brand-500"
        />
      </div>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Submit />
    </form>
  );
}
