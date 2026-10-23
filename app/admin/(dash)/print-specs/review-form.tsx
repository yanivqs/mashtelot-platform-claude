'use client';

import { useActionState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import { reviewSpecAction, type ReviewState } from './actions';

function Btn({ decision, label, cls }: { decision: string; label: string; cls: string }) {
  const { pending } = useFormStatus();
  return (
    <button name="decision" value={decision} disabled={pending} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${cls}`}>
      {label}
    </button>
  );
}

export function ReviewForm({ revisionId }: { revisionId: string }) {
  const [state, action] = useActionState(reviewSpecAction, {} as ReviewState);
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="revisionId" value={revisionId} />
      <Btn decision="approve" label="אישור המפרט" cls="bg-brand-600 text-white hover:bg-brand-700" />
      <input name="note" placeholder="הערה למשתלה (חובה בדחייה)" aria-label="הערה למשתלה" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      <Btn decision="reject" label="דחייה" cls="border border-rose-200 text-rose-700 hover:bg-rose-50" />
      {state.error && <span className="w-full text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
