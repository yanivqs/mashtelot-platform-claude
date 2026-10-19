'use client';

import { useState, useTransition } from 'react';
import { TemplateFields } from '@/components/print/template-fields';
import { quotePrint, validateValues, type RawValues, type TemplateField, type TemplatePricing } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import { createTemplateOrderAction, submitSpecAction } from './actions';

export interface TemplateVM {
  versionId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  unitLabel: string | null;
  leadTimeDays: number | null;
  fields: TemplateField[];
  pricing: TemplatePricing;
}

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function OrderForm({ t }: { t: TemplateVM }) {
  const [values, setValues] = useState<RawValues>({});
  const [qty, setQty] = useState(String(t.pricing.minQuantity));
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // PT-04: שמירה כמוצר קבוע (הגשת מפרט לאישור בית הדפוס) במקום הזמנה חד-פעמית
  const [saveMode, setSaveMode] = useState(false);
  const [savedName, setSavedName] = useState('');

  function submitSpec() {
    setError(null);
    start(async () => {
      const res = await submitSpecAction({ templateVersionId: t.versionId, values, name: savedName });
      if (res.ok) setDone('המוצר הקבוע נשלח לאישור בית הדפוס ✓ — אחרי האישור תוכלו להזמין אותו שוב בלחיצה.');
      else {
        setFieldErrors(res.fieldErrors ?? {});
        setError(res.error ?? (res.fieldErrors ? 'יש לתקן את השדות המסומנים' : 'שגיאה'));
      }
    });
  }

  // הערכת מחיר בדפדפן — אותו חישוב שרץ בשרת, שהוא הקובע
  const checked = validateValues(t.fields, values);
  const q = checked.ok ? quotePrint(t.pricing, t.fields, checked.values, Number(qty)) : null;

  if (done) return <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{done}</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await createTemplateOrderAction({ templateVersionId: t.versionId, values, quantity: Number(qty), notes });
          if (res.ok) {
            setDone(
              res.quoteOnly
                ? 'הבקשה נשלחה ✓ — בית הדפוס יחזור אליכם עם הצעת מחיר.'
                : `ההזמנה התקבלה ✓ — סה״כ ${formatPrice(res.total ?? 0)}.`,
            );
          } else {
            setFieldErrors(res.fieldErrors ?? {});
            setError(res.error ?? (res.fieldErrors ? 'יש לתקן את השדות המסומנים' : 'שגיאה'));
          }
        });
      }}
      className="space-y-4"
    >
      <TemplateFields fields={t.fields} values={values} errors={fieldErrors} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">כמות{t.unitLabel ? ` (${t.unitLabel})` : ''}</span>
          <input value={qty} type="number" min={t.pricing.minQuantity} onChange={(e) => setQty(e.target.value)} className={input} />
          <span className="mt-1 block text-xs text-gray-500">מינימום {t.pricing.minQuantity}</span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">הערות לבית הדפוס</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
        </label>
      </div>

      {t.pricing.quoteOnly ? (
        <p className="text-sm text-gray-600">המחיר נקבע בהצעת מחיר מבית הדפוס.</p>
      ) : q && q.ok ? (
        <div className="rounded-lg bg-gray-50 p-3 text-sm">
          <p className="font-bold">
            מחיר משוער: {formatPrice(q.quote.total)} <span className="font-normal text-gray-500">({formatPrice(q.quote.unitPrice)} ליחידה{q.quote.setupFee ? ` + הקמה ${formatPrice(q.quote.setupFee)}` : ''})</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">המחיר הסופי מחושב בשרת בעת השליחה.</p>
        </div>
      ) : q && !q.ok ? (
        <p className="text-sm text-amber-700">{q.error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? 'שולח...' : t.pricing.quoteOnly ? 'בקשת הצעת מחיר' : 'שליחת הזמנה'}
        </button>
        <button type="button" onClick={() => setSaveMode((m) => !m)} className="text-sm font-medium text-brand-700 hover:underline">
          {saveMode ? 'ביטול' : 'מזמינים את זה שוב ושוב? שמרו כמוצר קבוע'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      {saveMode && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">שם למוצר הקבוע</span>
            <input value={savedName} onChange={(e) => setSavedName(e.target.value)} placeholder="למשל: מדבקת לוגו לעציץ 1 ליטר" className={input} />
          </label>
          <button type="button" disabled={pending} onClick={submitSpec} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            הגשה לאישור בית הדפוס
          </button>
          <p className="w-full text-xs text-gray-500">אחרי האישור המפרט ננעל, ומזמינים ממנו שוב רק עם כמות והערות. שינוי — בבקשת שינוי לאישור.</p>
        </div>
      )}
    </form>
  );
}

/** קטלוג מוצרי הדפוס מתבניות מפורסמות (PT-02). */
export function TemplateCatalog({ templates }: { templates: TemplateVM[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <div key={t.versionId} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex gap-4">
            {t.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">{t.title}</h3>
              {t.description && <p className="mt-0.5 text-sm text-gray-600">{t.description}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {t.pricing.quoteOnly ? 'בהצעת מחיר' : `החל מ-${formatPrice(Math.min(t.pricing.basePrice, ...t.pricing.tiers.map((x) => x.unitPrice)))} ליחידה`}
                {t.leadTimeDays ? ` · זמן הפקה ${t.leadTimeDays} ימים` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen((o) => (o === t.versionId ? null : t.versionId))}
              className="self-start rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
              aria-expanded={open === t.versionId}
            >
              {open === t.versionId ? 'סגירה' : 'הזמנה'}
            </button>
          </div>
          {open === t.versionId && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <OrderForm t={t} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
