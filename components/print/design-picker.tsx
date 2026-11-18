'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { CheckCircle2, FileText, Search, X, ZoomIn } from 'lucide-react';
import { TemplateFields } from '@/components/print/template-fields';
import { PrintFileUpload } from '@/components/print/file-upload';
import { missingForSubmit, quotePrint, validateValues, type RawValues } from '@/lib/print-template';
import { designQuantity, type DesignRule } from '@/lib/print-designs';
import { formatPrice } from '@/lib/utils';
import type { CalculatorProduct } from '@/components/print/calculator';
import { createJobOrderAction } from '@/app/admin/(dash)/print-shop/actions';
import { startDraftArtworkUpload, type UploadedFile } from '@/app/admin/(dash)/print-shop/artwork-actions';

export interface PickerDesign {
  id: string;
  code: string;
  title: string;
  imageUrl: string;
  tags: string[];
}

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const units = (n: number) => n.toLocaleString('he-IL');

/**
 * הזמנה ממאגר דוגמאות (כרטיסי ברכה): בוחרים דוגמאות בכפולות של החבילה, והכמות נגזרת מהן.
 * ההודעות והמחיר מחושבים כאן לנוחות; השרת בודק ומחשב שוב בשליחה.
 */
export function DesignPicker({ product: t, designs, rule }: { product: CalculatorProduct; designs: PickerDesign[]; rule: DesignRule }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const [zoom, setZoom] = useState<PickerDesign | null>(null);
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [values, setValues] = useState<RawValues>({});
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; total: number; quoteOnly: boolean; count: number; perDesign: number; quantity: number } | null>(null);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const detailsRef = useRef<HTMLHeadingElement>(null);

  const byId = useMemo(() => new Map(designs.map((d) => [d.id, d])), [designs]);
  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of designs) for (const x of d.tags) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [designs]);
  const q = query.trim().toLowerCase();
  const chosen = new Set(selected);
  const visible = designs.filter(
    (d) => (!tag || d.tags.includes(tag)) && (!q || d.code.toLowerCase().includes(q) || d.title.toLowerCase().includes(q)) && (!onlySelected || chosen.has(d.id)),
  );

  const qty = designQuantity(rule, selected.length);
  const checked = validateValues(t.fields, values);
  const priced = qty.ok && checked.ok ? quotePrint(t.pricing, t.fields, checked.values, qty.total) : null;
  const quote = priced?.ok ? priced.quote : null;
  // המחיר להצגה גם לפני מילוי פרטי העסק
  const preview = qty.ok ? quotePrint(t.pricing, [], {}, qty.total) : null;
  const previewTotal = preview?.ok && !preview.quote.quoteOnly ? preview.quote.total : null;
  const missing = qty.ok ? missingForSubmit(t.pricing, t.fields, values, qty.total, { required: t.requiresArtwork, hasFile: Boolean(file), needsDesign: false }) : [qty.error];
  const fileMissingLabel = 'יש להעלות קובץ, או לסמן שצריך גם עיצוב';
  const missingShown = missing.map((m) => (m === fileMissingLabel ? 'יש להעלות קובץ לוגו' : m));

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const openZoom = (d: PickerDesign) => {
    setZoom(d);
    dialog.current?.showModal();
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-100 bg-white p-6 shadow-sm" data-testid="print-confirmation">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle2 className="h-6 w-6" />
          <h2 className="text-lg font-bold">{done.quoteOnly ? 'הבקשה נשלחה לבדיקת בית הדפוס' : 'ההזמנה התקבלה'}</h2>
        </div>
        <p className="mt-3 font-medium">{done.name}</p>
        <p className="mt-1 text-sm text-gray-700">
          {done.count} דוגמאות × {units(done.perDesign)} יח' = {units(done.quantity)} כרטיסים
        </p>
        {!done.quoteOnly && <p className="mt-2 text-lg font-bold">{formatPrice(done.total)} <span className="text-sm font-normal text-gray-600">לפני מע״מ</span></p>}
        <p className="mt-2 text-sm text-gray-600">בית הדפוס ישלח הגהה עם הלוגו לאישורך לפני ההדפסה.</p>
        <Link href="/admin/print-shop/jobs" className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          לעבודות שלי
        </Link>
      </div>
    );
  }

  const submit = () => {
    setError(null);
    if (!qty.ok) return setError(qty.error);
    start(async () => {
      const res = await createJobOrderAction({ templateVersionId: t.versionId, values, quantity: qty.total, notes, fileId: file?.id ?? null, designIds: selected });
      if (res.ok) {
        setDone({ name: res.name!, total: res.total ?? 0, quoteOnly: res.quoteOnly!, count: qty.count, perDesign: qty.perDesign, quantity: qty.total });
      } else {
        setFieldErrors(res.fieldErrors ?? {});
        setError(res.error ?? (res.missing ?? []).join(' · ') ?? 'שגיאה');
      }
    });
  };

  return (
    <div className="space-y-5 pb-28">
      {step === 'pick' ? (
        <>
          <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-[200px] flex-1">
                <span className="sr-only">חיפוש לפי קוד או שם</span>
                <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-500" aria-hidden />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי קוד או שם" className={`${input} pr-9`} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} className="h-4 w-4" />
                רק הדוגמאות שבחרתי
              </label>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="סינון לפי תגית">
              {[null, ...tags.map(([x]) => x)].map((x) => (
                <button
                  key={x ?? 'all'}
                  type="button"
                  aria-pressed={tag === x}
                  onClick={() => setTag(x)}
                  className={`rounded-full border px-3 py-1 text-sm ${tag === x ? 'border-brand-700 bg-brand-700 text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300'}`}
                >
                  {x ?? `הכול (${designs.length})`}
                  {x ? ` (${tags.find(([y]) => y === x)?.[1]})` : ''}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-gray-600" aria-live="polite">
            מוצגות {visible.length} דוגמאות
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="design-grid">
            {visible.map((d) => {
              const on = chosen.has(d.id);
              return (
                <li key={d.id} className={`relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${on ? 'border-brand-600 ring-2 ring-brand-600' : 'border-gray-100'}`} data-testid={`design-${d.code}`}>
                  <label className="flex flex-1 cursor-pointer flex-col">
                    <span className="flex aspect-square items-center justify-center bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.imageUrl} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                    </span>
                    <span className="flex items-start gap-2 border-t border-gray-100 p-2 text-sm">
                      <input type="checkbox" checked={on} onChange={() => toggle(d.id)} className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-medium" dir="ltr">
                          {d.code}
                        </span>
                        <span className="line-clamp-2 text-gray-700">{d.title}</span>
                      </span>
                    </span>
                  </label>
                  <button type="button" onClick={() => openZoom(d)} className="absolute left-2 top-2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow hover:bg-white" aria-label={`הגדלה: ${d.code} ${d.title}`}>
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-600">לא נמצאו דוגמאות.</p>}
        </>
      ) : (
        <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 ref={detailsRef} tabIndex={-1} className="text-lg font-bold outline-none">
              פרטי ההזמנה
            </h2>
            <button type="button" onClick={() => setStep('pick')} className="text-sm font-medium text-brand-700 hover:underline">
              חזרה לבחירת הדוגמאות
            </button>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              הדוגמאות שבחרת ({selected.length}){qty.ok ? ` · ${units(qty.perDesign)} יח' מכל דוגמא` : ''}
            </p>
            <ul className="flex flex-wrap gap-2" data-testid="design-selected">
              {selected.map((id) => {
                const d = byId.get(id);
                if (!d) return null;
                return (
                  <li key={id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-1 pl-2 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.imageUrl} alt="" className="h-10 w-10 rounded bg-white object-contain" />
                    <span dir="ltr">{d.code}</span>
                    <button type="button" onClick={() => toggle(id)} className="rounded p-1 text-gray-600 hover:bg-gray-200" aria-label={`הסרת ${d.code}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-700">
              קובץ לוגו{t.requiresArtwork ? <span className="text-rose-600"> *</span> : ' (לא חובה)'}
            </p>
            <PrintFileUpload label={file ? 'החלפת הלוגו' : 'העלאת לוגו'} withThumbnail start={() => startDraftArtworkUpload({ templateVersionId: t.versionId })} onDone={(f) => f && setFile(f)} />
            {file && (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2" data-testid="print-file">
                {file.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.thumbnailUrl} alt="" className="h-12 w-12 rounded object-contain" />
                ) : (
                  <FileText className="h-6 w-6 text-gray-500" />
                )}
                <span className="min-w-0 flex-1 break-all">{file.name}</span>
              </div>
            )}
          </div>

          <TemplateFields fields={t.fields} values={values} errors={fieldErrors} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">הערות לבית הדפוס</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className={input} />
          </label>
        </div>
      )}

      {/* פס קבוע: מצב הבחירה, הכמות והמחיר */}
      <div className="sticky bottom-0 z-20 -mx-1 rounded-xl border border-gray-200 bg-white p-3 shadow-lg" data-testid="design-bar">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 text-sm" aria-live="polite">
            <p className="font-bold">נבחרו {selected.length} דוגמאות</p>
            {qty.ok ? (
              <p className="text-gray-700" data-testid="design-status">
                {units(qty.perDesign)} מכל דוגמא · {units(qty.total)} יח'
                {previewTotal !== null && (
                  <>
                    {' · '}
                    <span className="font-bold text-gray-900">{formatPrice(quote && !quote.quoteOnly ? quote.total : previewTotal)}</span> לפני מע״מ
                  </>
                )}
              </p>
            ) : (
              <p className="text-amber-800" data-testid="design-status">
                {qty.error}
              </p>
            )}
            {step === 'details' && qty.ok && missingShown.length > 0 && <p className="text-xs text-gray-600">עוד חסר: {missingShown.join(' · ')}</p>}
          </div>
          {step === 'pick' ? (
            <button
              type="button"
              disabled={!qty.ok}
              onClick={() => {
                setStep('details');
                setTimeout(() => detailsRef.current?.focus(), 0);
              }}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              המשך להזמנה
            </button>
          ) : (
            <button
              type="button"
              disabled={missing.length > 0 || pending}
              onClick={submit}
              className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'שולח...' : 'שליחת ההזמנה'}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <dialog ref={dialog} onClose={() => setZoom(null)} className="max-h-[90vh] w-[min(92vw,640px)] rounded-xl p-0 backdrop:bg-black/60" aria-label={zoom ? `${zoom.code} ${zoom.title}` : 'הגדלה'}>
        {zoom && (
          <div className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-bold" dir="ltr">
                  {zoom.code}
                </p>
                <p className="text-sm text-gray-700">{zoom.title}</p>
              </div>
              <button type="button" onClick={() => dialog.current?.close()} className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100" aria-label="סגירה">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.imageUrl} alt={`${zoom.code} ${zoom.title}`} className="mx-auto max-h-[65vh] w-auto object-contain" />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={chosen.has(zoom.id)} onChange={() => toggle(zoom.id)} className="h-4 w-4" />
              בחירת הדוגמא
            </label>
          </div>
        )}
      </dialog>
    </div>
  );
}
