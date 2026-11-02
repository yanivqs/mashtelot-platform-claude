'use client';

import { useActionState, useRef } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import {
  updatePrintOrderStatus,
  quoteAction,
  type QuoteState,
  savePrintOption,
  deletePrintOption,
  type PrintProductState,
} from './actions';

const STATUS: Array<[string, string]> = [
  ['NEW', 'התקבלה'],
  ['IN_PRODUCTION', 'בהפקה'],
  ['SHIPPED', 'נשלחה'],
  ['DELIVERED', 'נמסרה'],
  ['CANCELLED', 'בוטלה'],
];

export function PrintStatusSelect({ id, status }: { id: string; status: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={updatePrintOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => ref.current?.requestSubmit()}
        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500"
      >
        {STATUS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </form>
  );
}

const initial: PrintProductState = {};
const field = 'rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? '...' : label}
    </button>
  );
}

/** שורת עריכה / הוספה של אפשרות גימור גלובלית. */
export function PrintOptionForm({
  option,
}: {
  option?: { id: string; optionName: string; extraPrice: string };
}) {
  const [state, action] = useActionState(savePrintOption, initial);
  const keep = useKeepFormValues(state);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form ref={keep} action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={option?.id ?? ''} />
        <input
          name="optionName"
          required
          defaultValue={option?.optionName}
          placeholder="שם האפשרות (למשל: למינציה מט)"
          className={`${field} w-64`}
        />
        <label className="flex items-center gap-1 text-sm text-gray-600">
          +₪
          <input
            name="extraPrice"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={option?.extraPrice}
            className={`${field} w-24`}
          />
          ליח׳
        </label>
        <SaveButton label={option ? 'שמירה' : 'הוספה'} />
        {state.ok && <span className="text-xs text-green-700">✓</span>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </form>
      {option && (
        <form action={deletePrintOption}>
          <input type="hidden" name="id" value={option.id} />
          <button className="text-xs text-red-600 hover:text-red-800">מחיקה</button>
        </form>
      )}
    </div>
  );
}

const QUOTE_LABEL = { NEW: 'חדש', IN_PROGRESS: 'בטיפול', SENT: 'נשלחה הצעה', APPROVED: 'אושר', REJECTED: 'נדחה' } as const;

export interface QuoteVM {
  id: string;
  status: keyof typeof QUOTE_LABEL | null;
  expired: boolean;
  total: number;
  validUntil: string | null;
  adminNotes: string | null;
  reasons: string[];
  needsDesign: boolean;
}

/** ניהול בקשת הצעת מחיר: סיבות, מחיר סופי, תוקף והערות פנימיות. */
export function QuotePanel({ q }: { q: QuoteVM }) {
  const [state, action] = useActionState(quoteAction, {} as QuoteState);
  const keep = useKeepFormValues(state);
  const status = q.status ?? 'NEW';
  return (
    <form ref={keep} action={action} className="space-y-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm" data-testid="quote-panel">
      <input type="hidden" name="id" value={q.id} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">בקשת הצעת מחיר</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-amber-900">{q.expired && status === 'SENT' ? 'פג תוקף' : QUOTE_LABEL[status]}</span>
        {q.needsDesign && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-sky-800">נדרש עיצוב</span>}
      </div>
      {q.reasons.length > 0 && (
        <ul className="list-inside list-disc text-xs text-amber-900">
          {q.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-0.5 block text-gray-700">מחיר סופי (₪)</span>
          <input name="total" type="number" step="0.01" min="0" defaultValue={q.total > 0 ? q.total : ''} aria-label="מחיר כולל להצעה" className="w-28 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm" />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-gray-700">בתוקף עד</span>
          <input name="validUntil" type="date" defaultValue={q.validUntil ?? ''} aria-label="תוקף ההצעה" className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm" />
        </label>
        <label className="min-w-40 flex-1 text-xs">
          <span className="mb-0.5 block text-gray-700">הערות פנימיות (לא מוצגות למשתלה)</span>
          <input name="adminNotes" defaultValue={q.adminNotes ?? ''} aria-label="הערות פנימיות" className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button name="intent" value="send" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">שליחת הצעה למשתלה</button>
        <button name="intent" value="progress" className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800">סימון בטיפול</button>
        <button name="intent" value="notes" className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800">שמירת הערות</button>
        <button name="intent" value="reject" className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700">דחיית הבקשה</button>
        {state.ok && <span className="text-xs text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
