'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { QuantityPicker, TemplateFields } from '@/components/print/template-fields';
import { PrintFileUpload } from '@/components/print/file-upload';
import { checkResolution, FILE_CHECK_LABELS } from '@/lib/print-preflight';
import { describeValues, missingForSubmit, quotePrint, sizeFromValues, validateValues, type RawValues, type TemplateField, type TemplatePricing } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import { createJobOrderAction } from '@/app/admin/(dash)/print-shop/actions';
import { startDraftArtworkUpload, type UploadedFile } from '@/app/admin/(dash)/print-shop/artwork-actions';

export interface CalculatorProduct {
  versionId: string;
  title: string;
  unitLabel: string | null;
  leadTimeDays: number | null;
  requiresArtwork: boolean;
  fields: TemplateField[];
  pricing: TemplatePricing;
}

export interface CalculatorPrefill {
  values: RawValues;
  quantity: number | null;
  file: UploadedFile | null;
}

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

interface Done {
  name: string;
  quoteOnly: boolean;
  total: number;
  perUnit: number;
  reasons: string[];
  quantity: number;
  summary: Array<{ label: string; value: string }>;
}

/** מחשבון הזמנה: כמות → שדות → קובץ, ובצד סיכום מחיר. החישוב זהה לשרת; השרת הוא הקובע. */
export function PrintCalculator({ product: t, prefill }: { product: CalculatorProduct; prefill?: CalculatorPrefill }) {
  const [values, setValues] = useState<RawValues>(prefill?.values ?? {});
  const [qty, setQty] = useState(String(prefill?.quantity ?? t.pricing.quantityOptions[0] ?? t.pricing.minQuantity));
  const [file, setFile] = useState<UploadedFile | null>(prefill?.file ?? null);
  const [needsDesign, setNeedsDesign] = useState(false);
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();

  const quantity = Number(qty);
  const activeFile = needsDesign ? null : file;
  const missing = missingForSubmit(t.pricing, t.fields, values, quantity, { required: t.requiresArtwork, hasFile: Boolean(activeFile), needsDesign });
  const checked = validateValues(t.fields, values);
  const fileCheck = activeFile ? checkResolution(activeFile, sizeFromValues(t.fields, values)) : null;
  const priced = checked.ok ? quotePrint(t.pricing, t.fields, checked.values, quantity, { needsDesign, lowResolution: fileCheck?.status === 'low' }) : null;
  const quote = priced?.ok ? priced.quote : null;

  if (done) {
    return (
      <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm" data-testid="print-confirmation">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-6 w-6" />
          <h2 className="text-lg font-bold">{done.quoteOnly ? 'הבקשה נשלחה לבדיקת בית הדפוס' : 'ההזמנה התקבלה'}</h2>
        </div>
        <p className="mt-3 font-medium">{done.name}</p>
        <ul className="mt-2 space-y-0.5 text-sm text-gray-700">
          <li>כמות: {done.quantity.toLocaleString('he-IL')}</li>
          {done.summary.map((s) => (
            <li key={s.label}>
              {s.label}: {s.value}
            </li>
          ))}
        </ul>
        {done.quoteOnly ? (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">בית הדפוס יבדוק ויחזור עם הצעת מחיר. למה?</p>
            <ul className="mt-1 list-inside list-disc">
              {done.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-lg font-bold">
            {formatPrice(done.total)} <span className="text-sm font-normal text-gray-600">({formatPrice(done.perUnit)} ליחידה)</span>
          </p>
        )}
        <Link href="/admin/print-shop/jobs" className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          לעבודות שלי
        </Link>
      </div>
    );
  }

  const canSend = missing.length === 0 && !pending;
  const submit = () => {
    setError(null);
    start(async () => {
      const res = await createJobOrderAction({ templateVersionId: t.versionId, values, quantity, notes, fileId: activeFile?.id ?? null, needsDesign });
      if (res.ok) {
        setDone({
          name: res.name!,
          quoteOnly: res.quoteOnly!,
          total: res.total ?? 0,
          perUnit: res.perUnit ?? 0,
          reasons: res.reasons ?? [],
          quantity,
          summary: checked.ok ? describeValues(t.fields, checked.values) : [],
        });
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        setError(res.error ?? (res.missing ?? []).join(' · ') ?? 'שגיאה');
      }
    });
  };

  const priceLine = quote && !quote.quoteOnly ? formatPrice(quote.total) : null;
  const sendLabel = pending ? 'שולח...' : quote?.quoteOnly ? 'שליחה לבדיקה' : 'קבלת מחיר והזמנה';

  return (
    <div className="grid items-start gap-6 pb-16 lg:grid-cols-[minmax(0,1fr)_300px] lg:pb-0">
      <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <QuantityPicker options={t.pricing.quantityOptions} allowCustom={t.pricing.allowCustomQuantity} min={t.pricing.minQuantity} unitLabel={t.unitLabel} quantity={qty} onChange={setQty} />
        <TemplateFields fields={t.fields} values={values} errors={fieldErrors} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />

        <div className="space-y-2 border-t border-gray-100 pt-5 text-sm">
          <p className="font-medium text-gray-700">
            קובץ לדפוס{t.requiresArtwork ? <span className="text-rose-600"> *</span> : ' (לא חובה)'}
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={needsDesign} onChange={(e) => setNeedsDesign(e.target.checked)} className="h-4 w-4" />
            אין לי קובץ, אני צריך גם עיצוב
          </label>
          {!needsDesign && (
            <>
              <PrintFileUpload
                label={file ? 'החלפת קובץ' : 'העלאת קובץ'}
                withThumbnail
                start={() => startDraftArtworkUpload({ templateVersionId: t.versionId })}
                onDone={(f) => f && setFile(f)}
              />
              {file && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2" data-testid="print-file">
                  {file.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.thumbnailUrl} alt="" className="h-12 w-12 rounded object-contain" />
                  ) : (
                    <FileText className="h-6 w-6 text-gray-500" />
                  )}
                  <span className="min-w-0 flex-1 break-all">{file.name}</span>
                  {fileCheck && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fileCheck.status === 'ok' ? 'bg-green-50 text-green-800' : fileCheck.status === 'low' ? 'bg-amber-50 text-amber-900' : 'bg-gray-100 text-gray-700'}`}>
                      {FILE_CHECK_LABELS[fileCheck.status]}
                      {fileCheck.dpi ? ` · ${fileCheck.dpi} DPI` : ''}
                    </span>
                  )}
                  {file.critical.map((c) => (
                    <p key={c} className="w-full text-xs text-rose-700">
                      {c}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">הערות לבית הדפוס</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className={input} />
        </label>
      </div>

      <aside id="print-summary" className="space-y-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:sticky lg:top-4" aria-live="polite">
        <h2 className="font-bold">סיכום</h2>
        {quote?.quoteOnly ? (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" data-testid="print-review">
            <p className="font-medium">יעבור לבדיקת צוות, בלי מחיר מיידי:</p>
            <ul className="mt-1 list-inside list-disc">
              {quote.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : quote ? (
          <div data-testid="print-price">
            <p className="text-2xl font-bold">{priceLine}</p>
            <p className="text-sm text-gray-600">{formatPrice(quote.perUnit)} ליחידה</p>
            <p className="mt-1 text-xs text-gray-600">המחיר הסופי מחושב בשרת בעת השליחה. המחירים מוצגים כפי שהוגדרו בבית הדפוס.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">המחיר יופיע אחרי מילוי הפרטים.</p>
        )}
        {t.leadTimeDays ? <p className="text-xs text-gray-600">זמן הפקה: {t.leadTimeDays} ימים</p> : null}
        {missing.length > 0 && (
          <div className="text-sm" data-testid="print-missing">
            <p className="font-medium text-gray-700">עוד חסר:</p>
            <ul className="mt-1 list-inside list-disc text-gray-700">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" disabled={!canSend} onClick={submit} className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50">
          {sendLabel}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </aside>

      {/* במובייל: המחיר והחוסרים תמיד בעין; הכפתור בסיכום שמתחת */}
      <a href="#print-summary" className="fixed inset-x-4 bottom-2 z-20 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg lg:hidden">
        <span>{priceLine ?? (quote?.quoteOnly ? 'בדיקת צוות' : 'המחיר יופיע בהמשך')}</span>
        <span>{missing.length > 0 ? `חסרים ${missing.length} פרטים` : 'לסיכום ושליחה'}</span>
      </a>
    </div>
  );
}
