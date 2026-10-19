'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { PrintFileUpload } from '@/components/print/file-upload';
import { phoneDecision, startProofUpload, type DecisionState } from '../print-shop/artwork-actions';

export function ProofUpload({ versionId }: { versionId: string }) {
  const router = useRouter();
  return <PrintFileUpload label="העלאת הגהה" start={() => startProofUpload(versionId)} onDone={() => router.refresh()} />;
}

/** תיעוד אישור/דחייה שהמשתלה מסרה בטלפון (החלטת בעלים) — חובה לכתוב עם מי ומתי. */
export function PhoneDecision({ versionId }: { versionId: string }) {
  const [state, action] = useActionState(phoneDecision, {} as DecisionState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="versionId" value={versionId} />
      <input name="note" placeholder="למשל: אושר טלפונית ע״י דני, 19/10 14:30" aria-label="תיעוד שיחה" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
      <button name="decision" value="approve" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
        אישור טלפוני
      </button>
      <button name="decision" value="reject" className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50">
        דחייה טלפונית
      </button>
      {state.error && <span className="w-full text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
