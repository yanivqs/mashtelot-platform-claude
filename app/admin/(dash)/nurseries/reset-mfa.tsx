'use client';

import { useActionState } from 'react';
import { resetUserMfaAction, type MfaState } from '../account/mfa-actions';

/** סופר-אדמין: איפוס אימות דו-שלבי למשתמש (עם אישור בדפדפן; נאכף ונרשם בשרת). */
export function ResetMfaButton({ userId, email }: { userId: string; email: string }) {
  const [state, action] = useActionState(resetUserMfaAction, {} as MfaState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`לאפס את האימות הדו-שלבי של ${email}? המשתמש ינותק מכל המכשירים.`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <button className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">איפוס אימות דו-שלבי</button>
      {state.ok && <span className="text-xs text-green-700">אופס ✓</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
