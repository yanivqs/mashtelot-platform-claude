'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendTestEmail, type TestEmailState } from './actions';

const initial: TestEmailState = {};

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {pending ? 'שולח...' : 'שליחת מייל בדיקה'}
    </button>
  );
}

export function TestEmailForm({ defaultTo }: { defaultTo: string }) {
  const [state, action] = useActionState(sendTestEmail, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          name="to"
          type="email"
          required
          dir="ltr"
          defaultValue={defaultTo}
          className="min-w-64 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <SendButton />
      </div>
      {state.message && (
        <p
          dir="auto"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
