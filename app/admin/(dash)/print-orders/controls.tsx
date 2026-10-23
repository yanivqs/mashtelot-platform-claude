'use client';

import { useActionState, useRef } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import {
  updatePrintOrderStatus,
  setQuotePrice,
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

/** בקשת הצעת מחיר: קביעת מחיר כולל → ההזמנה עוברת ל"התקבלה". */
export function QuotePriceForm({ id }: { id: string }) {
  const [state, action] = useActionState(setQuotePrice, {} as QuoteState);
  const keep1 = useKeepFormValues(state);
  return (
    <form ref={keep1} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">ממתינה להצעת מחיר</span>
      <input name="total" type="number" step="0.01" min="0" placeholder="סה״כ ₪" aria-label="מחיר כולל להצעה" className="w-28 rounded-md border border-gray-200 px-2 py-1 text-sm" />
      <SaveButton label="קביעת מחיר" />
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
