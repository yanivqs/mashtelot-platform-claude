'use client';

import { useActionState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useRouter } from 'next/navigation';
import { ownerDecision, startArtworkUpload, type DecisionState } from '@/app/admin/(dash)/print-shop/artwork-actions';
import { PrintFileUpload } from './file-upload';
import { PreflightNotes } from './preflight-notes';
import type { PreflightResult } from '@/lib/print-preflight';
import { ARTWORK_STATUS, type ArtworkStatus } from '@/lib/print-artwork-status';

export interface ArtworkVersionVM {
  id: string;
  version: number;
  status: ArtworkStatus;
  fileName: string;
  fileUrl: string;
  /** בדיקת קובץ בסיסית מול פרופיל הייצור — מידע למשתלה, לא חוסם העלאה */
  preflight?: PreflightResult | null;
  proofUrl: string | null;
  note: string | null;
  decidedBy: string | null;
  method: 'OWNER' | 'PHONE' | null;
  createdAt: string;
}


function Decide({ versionId }: { versionId: string }) {
  const [state, action] = useActionState(ownerDecision, {} as DecisionState);
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="versionId" value={versionId} />
      <button name="decision" value="approve" className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
        אישור ההגהה לדפוס
      </button>
      <input name="note" placeholder="מה לתקן (בדחייה)" aria-label="הערה להגהה" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
      <button name="decision" value="reject" className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50">
        דחייה
      </button>
      {state.error && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

/** גרפיקה והגהות (PT-05) — למוצר קבוע או להזמנה. האישור מתייחס לגרסה המוצגת בלבד. */
export function ArtworkPanel({
  subject,
  versions,
}: {
  subject: { savedProductId?: string; printOrderId?: string };
  versions: ArtworkVersionVM[];
}) {
  const router = useRouter();
  const latest = versions[0];
  return (
    <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">גרפיקה</span>
        <PrintFileUpload label={latest ? 'העלאת גרסה חדשה' : 'העלאת קובץ גרפיקה'} start={() => startArtworkUpload(subject)} onDone={() => router.refresh()} />
      </div>
      {latest && latest.status !== 'APPROVED' && latest.status !== 'PROOF_SENT' && latest.status !== 'REJECTED' && (
        <p className="text-xs text-gray-500">העלאת גרסה חדשה מבטלת אישור קודם — כל גרסה מאושרת בנפרד.</p>
      )}
      <ul className="space-y-2">
        {versions.map((v) => (
          <li key={v.id} className={`rounded-lg bg-white p-2 text-xs ${v.status === 'SUPERSEDED' ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">גרסה {v.version}</span>
              <span className={`rounded-full px-2 py-0.5 ${ARTWORK_STATUS[v.status].cls}`}>{ARTWORK_STATUS[v.status].label}</span>
              <a href={v.fileUrl} className="text-brand-700 hover:underline">
                {v.fileName}
              </a>
              {v.proofUrl && (
                <a href={v.proofUrl} className="font-medium text-brand-700 hover:underline">
                  הורדת ההגהה
                </a>
              )}
            </div>
            {v.id === latest?.id && v.preflight && (
              <div className="mt-1">
                <PreflightNotes result={v.preflight} />
              </div>
            )}
            {v.status === 'APPROVED' && (
              <p className="mt-1 text-gray-500">
                אושר {v.method === 'PHONE' ? 'טלפונית (תועד ע״י בית הדפוס)' : 'במערכת'} · {v.decidedBy}
                {v.note ? ` · ${v.note}` : ''}
              </p>
            )}
            {v.status === 'REJECTED' && v.note && <p className="mt-1 text-rose-700">{v.note}</p>}
            {v.status === 'PROOF_SENT' && v.id === latest?.id && (
              <div className="mt-2">
                <Decide versionId={v.id} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
