'use client';

import { useActionState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Check, X } from 'lucide-react';
import { PrintFileUpload } from '@/components/print/file-upload';
import { PreflightNotes } from '@/components/print/preflight-notes';
import type { PreflightResult } from '@/lib/print-preflight';
import { startProductionUpload } from '../print-shop/artwork-actions';
import { PRODUCTION_LABELS, type GateCheck, type ProductionStatus } from '@/lib/print-release';
import { approveSpecAction, moveProductionAction, releaseAction, type ProductionState } from './actions';

const initial: ProductionState = {};

function Btn({ label, cls = 'bg-gray-900 text-white', disabled }: { label: string; cls?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${cls}`}>
      {pending ? '...' : label}
    </button>
  );
}

export interface ProductionVM {
  orderId: string;
  status: ProductionStatus;
  released: boolean;
  gate: { ok: boolean; checks: GateCheck[] };
  needsSpecApproval: boolean;
  productionFile: { name: string; url: string; sha256: string; preflight: PreflightResult | null } | null;
  snapshot: null | { at: string; by: string | null; artworks: string[]; fileSha: string };
  note: string | null;
  next: ProductionStatus[];
}

const STATUS_CLS: Record<ProductionStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  RELEASED: 'bg-sky-50 text-sky-700',
  IN_PRODUCTION: 'bg-indigo-50 text-indigo-700',
  QC: 'bg-amber-50 text-amber-800',
  COMPLETED: 'bg-green-50 text-green-700',
  BLOCKED: 'bg-rose-50 text-rose-700',
};

/** ייצור (PT-06): בדיקת השער, אישור מפרט, קובץ ייצור, שחרור ומעברי מצב — הכל נאכף שוב בשרת. */
export function ProductionPanel({ p }: { p: ProductionVM }) {
  const router = useRouter();
  const [specState, specAction] = useActionState(approveSpecAction, initial);
  const [relState, relAction] = useActionState(releaseAction, initial);
  const [moveState, moveAction] = useActionState(moveProductionAction, initial);
  const keepMove = useKeepFormValues(moveState);

  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">ייצור</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[p.status]}`}>{PRODUCTION_LABELS[p.status]}</span>
        {p.status === 'BLOCKED' && p.note && <span className="text-xs text-rose-700">{p.note}</span>}
      </div>

      {!p.released && (
        <>
          <ul className="grid gap-1 sm:grid-cols-2">
            {p.gate.checks
              .filter((c) => c.key !== 'status' && !(c.key === 'preflight' && !p.productionFile))
              .map((c) => (
                <li key={c.key} className="flex items-center gap-1.5">
                  {c.ok ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-rose-500" />}
                  <span className={c.ok ? 'text-gray-700' : 'text-gray-900'}>{c.label}</span>
                  {c.detail && <span className="text-xs text-gray-500">— {c.detail}</span>}
                </li>
              ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            {p.needsSpecApproval && (
              <form action={specAction}>
                <input type="hidden" name="id" value={p.orderId} />
                <Btn label="אישור מפרט ההזמנה" cls="border border-gray-300 bg-white text-gray-800" />
              </form>
            )}
            <PrintFileUpload label={p.productionFile ? 'החלפת קובץ ייצור' : 'העלאת קובץ ייצור'} start={() => startProductionUpload(p.orderId)} onDone={() => router.refresh()} />
          </div>
          {p.productionFile && (
            <p className="text-xs text-gray-500">
              קובץ ייצור:{' '}
              <a href={p.productionFile.url} className="text-brand-700 hover:underline">
                {p.productionFile.name}
              </a>{' '}
              · SHA-256 {p.productionFile.sha256.slice(0, 12)}…
            </p>
          )}
          {p.productionFile?.preflight && <PreflightNotes result={p.productionFile.preflight} />}
          {p.status === 'PENDING' && (
            <form action={relAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={p.orderId} />
              <Btn label="שחרור לייצור" cls="bg-brand-600 text-white hover:bg-brand-700" disabled={!p.gate.ok} />
              {!p.gate.ok && <span className="text-xs text-gray-500">השחרור זמין כשכל התנאים מתקיימים</span>}
            </form>
          )}
        </>
      )}

      {p.snapshot && (
        <p className="text-xs text-gray-600">
          שוחרר {p.snapshot.at} ע״י {p.snapshot.by ?? '—'} · קובץ ייצור SHA-256 {p.snapshot.fileSha.slice(0, 12)}…
          {p.snapshot.artworks.length > 0 && ` · גרפיקה: ${p.snapshot.artworks.join(', ')}`}
        </p>
      )}

      {p.next.length > 0 && (
        <form ref={keepMove} action={moveAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={p.orderId} />
          {p.next
            .filter((s) => s !== 'BLOCKED')
            .map((s) => (
              <button key={s} name="to" value={s} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-100">
                → {PRODUCTION_LABELS[s]}
              </button>
            ))}
          {p.next.includes('BLOCKED') && (
            <>
              <input name="note" placeholder="סיבת חסימה" aria-label="סיבת חסימה" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
              <button name="to" value="BLOCKED" className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50">
                חסימה
              </button>
            </>
          )}
        </form>
      )}

      {[specState.error, moveState.error].filter(Boolean).map((e) => (
        <p key={e} className="text-xs text-red-600">{e}</p>
      ))}
      {relState.error && (
        <p className="text-xs text-red-600">
          {relState.error}
          {relState.failed?.length ? `: ${relState.failed.join(', ')}` : ''}
        </p>
      )}
    </div>
  );
}
