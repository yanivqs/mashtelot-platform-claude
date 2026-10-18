'use client';

import { useActionState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { changePasswordAction, type ChangePasswordState } from './actions';

const initial: ChangePasswordState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'שומר...' : 'החלפת סיסמה'}
    </button>
  );
}

export function PasswordForm({ minLength }: { minLength: number }) {
  const [state, action] = useActionState(changePasswordAction, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="max-w-sm space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">סיסמה נוכחית</span>
        <input name="current" type="password" required autoComplete="current-password" className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">סיסמה חדשה</span>
        <input
          name="next"
          type="password"
          required
          minLength={minLength}
          autoComplete="new-password"
          className={field}
        />
        <span className="mt-1 block text-xs text-gray-400">לפחות {minLength} תווים. מומלץ ממנהל סיסמאות.</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">אימות סיסמה חדשה</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={minLength}
          autoComplete="new-password"
          className={field}
        />
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.ok && <span className="text-sm text-green-700">הסיסמה הוחלפה ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
