'use client';

import { useState, useTransition } from 'react';
import { TemplateFields } from '@/components/print/template-fields';
import { quotePrint, type CleanValues, type RawValues, type TemplateField, type TemplatePricing } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import { archiveSavedAction, reorderSavedAction, submitSpecAction } from './actions';

export interface SavedVM {
  id: string;
  name: string;
  templateTitle: string;
  /** מפרט פעיל מאושר (ממנו מזמינים) */
  active: null | {
    revision: number;
    display: Array<{ label: string; value: string }>;
    raw: CleanValues;
    fields: TemplateField[];
    pricing: TemplatePricing;
  };
  /** הבקשה האחרונה שלא אושרה (ממתינה או נדחתה) */
  latest: null | { revision: number; status: 'SUBMITTED' | 'REJECTED'; note: string | null };
  /** טופס בקשת שינוי — לפי הגרסה המפורסמת של התבנית (null אם אינה זמינה) */
  change: null | { templateVersionId: string; fields: TemplateField[]; prefill: RawValues };
}

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Reorder({ item }: { item: SavedVM }) {
  const a = item.active!;
  const [qty, setQty] = useState(String(a.pricing.minQuantity));
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const q = quotePrint(a.pricing, a.fields, a.raw, Number(qty));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await reorderSavedAction({ savedProductId: item.id, quantity: Number(qty), notes });
          setMsg(r.ok ? { ok: true, text: r.quoteOnly ? 'בקשת הצעת מחיר נשלחה ✓' : `ההזמנה התקבלה ✓ — ${formatPrice(r.total ?? 0)}` } : { ok: false, text: r.error ?? 'שגיאה' });
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="text-sm">
        <span className="mb-1 block text-gray-700">כמות</span>
        <input value={qty} type="number" min={a.pricing.minQuantity} onChange={(e) => setQty(e.target.value)} aria-label={`כמות — ${item.name}`} className={`${input} w-28`} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-700">הערות</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
      </label>
      <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
        {pending ? 'שולח...' : 'הזמנה חוזרת'}
      </button>
      <span className="text-sm text-gray-600">
        {a.pricing.quoteOnly ? 'בהצעת מחיר' : q.ok ? `משוער: ${formatPrice(q.quote.total)}` : q.error}
      </span>
      {msg && <span className={`w-full text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</span>}
    </form>
  );
}

function ChangeRequest({ item, onDone }: { item: SavedVM; onDone: () => void }) {
  const c = item.change!;
  const [values, setValues] = useState<RawValues>(c.prefill);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <TemplateFields fields={c.fields} values={values} errors={errors} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await submitSpecAction({ templateVersionId: c.templateVersionId, values, savedProductId: item.id });
              if (r.ok) onDone();
              else {
                setErrors(r.fieldErrors ?? {});
                setError(r.error ?? 'יש לתקן את השדות המסומנים');
              }
            })
          }
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'שולח...' : 'הגשת השינוי לאישור'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      <p className="text-xs text-gray-500">עד שהשינוי יאושר, הזמנות חוזרות ממשיכות מהמפרט המאושר הנוכחי.</p>
    </div>
  );
}

const badge = (cls: string, text: string) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>;

export function SavedProducts({ items }: { items: SavedVM[] }) {
  const [changing, setChanging] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">{it.name}</h3>
              <p className="text-xs text-gray-500">{it.templateTitle}{it.active ? ` · מפרט ${it.active.revision} מאושר` : ''}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {it.active && badge('bg-green-50 text-green-700', 'מאושר')}
              {it.latest?.status === 'SUBMITTED' && badge('bg-amber-50 text-amber-800', it.active ? 'שינוי ממתין לאישור' : 'ממתין לאישור בית הדפוס')}
              {it.latest?.status === 'REJECTED' && badge('bg-rose-50 text-rose-700', 'בקשה נדחתה')}
            </div>
          </div>

          {it.latest?.status === 'REJECTED' && it.latest.note && (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">הערת בית הדפוס: {it.latest.note}</p>
          )}

          {it.active && (
            <>
              <ul className="mt-2 text-sm text-gray-600">
                {it.active.display.map((d) => (
                  <li key={d.label}>
                    <span className="text-gray-500">{d.label}:</span> {d.value}
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-gray-100 pt-3">
                <Reorder item={it} />
              </div>
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {it.change && it.latest?.status !== 'SUBMITTED' && (
              <button type="button" onClick={() => setChanging((c) => (c === it.id ? null : it.id))} className="font-medium text-brand-700 hover:underline">
                {changing === it.id ? 'ביטול' : it.active ? 'בקשת שינוי במפרט' : 'הגשה מחדש'}
              </button>
            )}
            <form action={archiveSavedAction}>
              <input type="hidden" name="id" value={it.id} />
              <button className="text-gray-500 hover:text-red-600">הסרה מהרשימה</button>
            </form>
          </div>
          {changing === it.id && it.change && (
            <div className="mt-3">
              <ChangeRequest item={it} onDone={() => setChanging(null)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
