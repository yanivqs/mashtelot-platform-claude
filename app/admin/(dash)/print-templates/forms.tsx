'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';
import { TemplateFields } from '@/components/print/template-fields';
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  parseFields,
  parsePricing,
  quotePrint,
  validateValues,
  type FieldType,
  type RawValues,
} from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import {
  createTemplateAction,
  publishDraftAction,
  saveDraftAction,
  updateTemplateMetaAction,
  type TemplateFormState,
} from './actions';

const initial: TemplateFormState = {};
const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit({ label, pendingLabel = 'שומר...', tone = 'brand' }: { label: string; pendingLabel?: string; tone?: 'brand' | 'dark' }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${tone === 'brand' ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-900 hover:bg-gray-800'}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: TemplateFormState }) {
  return (
    <>
      {state.message && <span className="text-sm text-green-700">{state.message}</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state.errors && (
        <ul className="w-full list-disc rounded-lg bg-red-50 p-3 pr-6 text-sm text-red-700">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function NewTemplateForm() {
  const [state, action] = useActionState(createTemplateAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input name="title" placeholder='למשל: מדבקות לעציצים' aria-label="שם המוצר" className={`${field} max-w-sm`} />
      <Submit label="יצירה" pendingLabel="יוצר..." />
      <Feedback state={state} />
    </form>
  );
}

export interface MetaValues {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  unitLabel: string | null;
  leadTimeDays: number | null;
  isActive: boolean;
}

export function MetaForm({ meta }: { meta: MetaValues }) {
  const [state, action] = useActionState(updateTemplateMetaAction, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={meta.id} />
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם המוצר</span>
        <input name="title" defaultValue={meta.title} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קטגוריה</span>
        <input name="category" defaultValue={meta.category ?? ''} placeholder="תוויות / שילוט / מיתוג" className={field} />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">תיאור</span>
        <textarea name="description" rows={2} defaultValue={meta.description ?? ''} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">יחידה (למשל: מדבקה, שלט)</span>
        <input name="unitLabel" defaultValue={meta.unitLabel ?? ''} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">זמן הפקה (ימים)</span>
        <input name="leadTimeDays" type="number" min="0" defaultValue={meta.leadTimeDays ?? ''} className={field} />
      </label>
      <div className="sm:col-span-2">
        <ImageUpload name="imageUrl" defaultValue={meta.imageUrl} label="תמונת דוגמה" folder="misc" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input name="isActive" type="checkbox" defaultChecked={meta.isActive} className="h-4 w-4" />
        מוצג למשתלות להזמנה (רק כשיש גרסה מפורסמת)
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit label="שמירת פרטי המוצר" />
        <Feedback state={state} />
      </div>
    </form>
  );
}

// ---------- עורך הטיוטה ----------

interface EditOption {
  value: string;
  label: string;
  priceDelta: string;
}
interface EditField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  help: string;
  maxLength: string;
  min: string;
  max: string;
  options: EditOption[];
  showIfField: string;
  showIfEquals: string;
}

const blankField = (n: number): EditField => ({
  key: `field_${n}`,
  label: '',
  type: 'text',
  required: false,
  help: '',
  maxLength: '',
  min: '',
  max: '',
  options: [],
  showIfField: '',
  showIfEquals: '',
});

function toEdit(raw: unknown[]): EditField[] {
  return raw.map((r, i) => {
    const f = (r ?? {}) as Record<string, unknown>;
    const showIf = (f.showIf ?? {}) as Record<string, unknown>;
    return {
      ...blankField(i + 1),
      key: String(f.key ?? ''),
      label: String(f.label ?? ''),
      type: (FIELD_TYPES as readonly string[]).includes(String(f.type)) ? (f.type as FieldType) : 'text',
      required: f.required === true,
      help: String(f.help ?? ''),
      maxLength: f.maxLength === undefined ? '' : String(f.maxLength),
      min: f.min === undefined ? '' : String(f.min),
      max: f.max === undefined ? '' : String(f.max),
      options: Array.isArray(f.options)
        ? f.options.map((o) => {
            const oo = (o ?? {}) as Record<string, unknown>;
            return { value: String(oo.value ?? ''), label: String(oo.label ?? ''), priceDelta: String(oo.priceDelta ?? 0) };
          })
        : [],
      showIfField: String(showIf.field ?? ''),
      showIfEquals: String(showIf.equals ?? ''),
    };
  });
}

function toJson(fields: EditField[]) {
  return fields.map((f) => ({
    key: f.key.trim(),
    label: f.label.trim(),
    type: f.type,
    required: f.required,
    ...(f.help.trim() ? { help: f.help.trim() } : {}),
    ...(f.maxLength ? { maxLength: Number(f.maxLength) } : {}),
    ...(f.min !== '' ? { min: Number(f.min) } : {}),
    ...(f.max !== '' ? { max: Number(f.max) } : {}),
    ...(f.type === 'select' || f.type === 'multiselect'
      ? { options: f.options.map((o) => ({ value: o.value.trim(), label: o.label.trim() || o.value.trim(), priceDelta: Number(o.priceDelta || 0) })) }
      : {}),
    ...(f.showIfField ? { showIf: { field: f.showIfField, equals: f.showIfEquals } } : {}),
  }));
}

export interface PricingValues {
  basePrice: number;
  setupFee: number;
  minQuantity: number;
  quoteOnly: boolean;
  tiers: Array<{ minQty: number; unitPrice: number }>;
}

export function DraftEditor({
  templateId,
  version,
  initialFields,
  initialPricing,
  notes,
}: {
  templateId: string;
  version: number;
  initialFields: unknown[];
  initialPricing: PricingValues;
  notes: string | null;
}) {
  const [saveState, saveAction] = useActionState(saveDraftAction, initial);
  const [pubState, pubAction] = useActionState(publishDraftAction, initial);
  const [fields, setFields] = useState<EditField[]>(() => toEdit(initialFields));
  const [pricing, setPricing] = useState({
    basePrice: String(initialPricing.basePrice ?? 0),
    setupFee: String(initialPricing.setupFee ?? 0),
    minQuantity: String(initialPricing.minQuantity ?? 1),
    quoteOnly: initialPricing.quoteOnly === true,
    tiers: (initialPricing.tiers ?? []).map((t) => `${t.minQty} | ${t.unitPrice}`).join('\n'),
  });
  const [preview, setPreview] = useState<RawValues>({});
  const [qty, setQty] = useState('');

  const fieldsJson = useMemo(() => toJson(fields), [fields]);
  const pricingJson = useMemo(
    () => ({
      basePrice: Number(pricing.basePrice || 0),
      setupFee: Number(pricing.setupFee || 0),
      minQuantity: Number(pricing.minQuantity || 1),
      quoteOnly: pricing.quoteOnly,
      tiers: pricing.tiers
        .split('\n')
        .map((l) => l.split('|').map((s) => s.trim()))
        .filter((p) => p.length === 2 && p[0] && p[1])
        .map(([a, b]) => ({ minQty: Number(a), unitPrice: Number(b) })),
    }),
    [pricing],
  );
  const parsedFields = parseFields(fieldsJson);
  const parsedPricing = parsePricing(pricingJson);
  const issues = [...(parsedFields.ok ? [] : parsedFields.errors), ...(parsedPricing.ok ? [] : parsedPricing.errors)];

  const update = (i: number, patch: Partial<EditField>) => setFields((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((prev) => {
      const next = [...prev];
      const j = i + d;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  // תצוגה מקדימה: אותו טופס שהמשתלה תראה, ואותו חישוב מחיר (מחושב שוב בשרת בהזמנה)
  let previewPrice: string | null = null;
  if (parsedFields.ok && parsedPricing.ok && qty) {
    const v = validateValues(parsedFields.value, preview);
    const q = v.ok ? quotePrint(parsedPricing.value, parsedFields.value, v.values, Number(qty)) : null;
    previewPrice = !v.ok ? 'יש שדות חובה או ערכים לא תקינים' : q && q.ok ? (q.quote.quoteOnly ? 'הצעת מחיר בלבד' : `${formatPrice(q.quote.total)} (${formatPrice(q.quote.unitPrice)} ליח׳)`) : q && !q.ok ? q.error : null;
  }

  return (
    <div className="space-y-6">
      <form action={saveAction} className="space-y-5">
        <input type="hidden" name="id" value={templateId} />
        <input type="hidden" name="fields" value={JSON.stringify(fieldsJson)} />
        <input type="hidden" name="pricing" value={JSON.stringify(pricingJson)} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">שדות (טיוטה, גרסה {version})</h3>
            <button type="button" onClick={() => setFields((p) => [...p, blankField(p.length + 1)])} className="text-sm font-medium text-brand-700 hover:underline">
              + הוספת שדה
            </button>
          </div>
          {fields.length === 0 && <p className="text-sm text-gray-500">אין שדות. הוסיפו שדות שהמשתלה תמלא (טקסט להדפסה, חומר, גודל וכו׳).</p>}
          {fields.map((f, i) => {
            const earlier = fields.slice(0, i).filter((x) => ['select', 'multiselect', 'boolean'].includes(x.type) && x.key);
            const ref = earlier.find((x) => x.key === f.showIfField);
            return (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="grid gap-2 sm:grid-cols-4">
                  <label className="text-xs">
                    <span className="mb-0.5 block text-gray-600">תווית</span>
                    <input value={f.label} onChange={(e) => update(i, { label: e.target.value })} aria-label={`תווית שדה ${i + 1}`} className={field} />
                  </label>
                  <label className="text-xs">
                    <span className="mb-0.5 block text-gray-600">מפתח (אנגלית)</span>
                    <input value={f.key} dir="ltr" onChange={(e) => update(i, { key: e.target.value })} aria-label={`מפתח שדה ${i + 1}`} className={field} />
                  </label>
                  <label className="text-xs">
                    <span className="mb-0.5 block text-gray-600">סוג</span>
                    <select value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType })} aria-label={`סוג שדה ${i + 1}`} className={`${field} bg-white`}>
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FIELD_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-1.5 pb-2 text-xs">
                      <input type="checkbox" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
                      חובה
                    </label>
                    <span className="mr-auto flex gap-1 pb-1.5">
                      <button type="button" aria-label="למעלה" onClick={() => move(i, -1)} className="rounded p-1 text-gray-500 hover:bg-gray-100"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" aria-label="למטה" onClick={() => move(i, 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" aria-label="מחיקת שדה" onClick={() => setFields((p) => p.filter((_, j) => j !== i))} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </span>
                  </div>
                </div>

                {(f.type === 'select' || f.type === 'multiselect') && (
                  <div className="mt-2 space-y-1">
                    <span className="text-xs text-gray-600">אפשרויות (ערך באנגלית · תווית · תוספת מחיר ליחידה)</span>
                    {f.options.map((o, k) => (
                      <div key={k} className="flex gap-2">
                        <input value={o.value} dir="ltr" placeholder="pvc" aria-label="ערך" onChange={(e) => update(i, { options: f.options.map((x, m) => (m === k ? { ...x, value: e.target.value } : x)) })} className={field} />
                        <input value={o.label} placeholder="PVC" aria-label="תווית אפשרות" onChange={(e) => update(i, { options: f.options.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} className={field} />
                        <input value={o.priceDelta} type="number" step="0.01" aria-label="תוספת מחיר" onChange={(e) => update(i, { options: f.options.map((x, m) => (m === k ? { ...x, priceDelta: e.target.value } : x)) })} className={`${field} max-w-28`} />
                        <button type="button" aria-label="מחיקת אפשרות" onClick={() => update(i, { options: f.options.filter((_, m) => m !== k) })} className="rounded p-1 text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => update(i, { options: [...f.options, { value: '', label: '', priceDelta: '0' }] })} className="text-xs text-brand-700 hover:underline">
                      + אפשרות
                    </button>
                  </div>
                )}

                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {(f.type === 'text' || f.type === 'textarea') && (
                    <label className="text-xs">
                      <span className="mb-0.5 block text-gray-600">אורך מקסימלי</span>
                      <input value={f.maxLength} type="number" min="1" onChange={(e) => update(i, { maxLength: e.target.value })} className={field} />
                    </label>
                  )}
                  {f.type === 'number' && (
                    <>
                      <label className="text-xs">
                        <span className="mb-0.5 block text-gray-600">מינימום</span>
                        <input value={f.min} type="number" onChange={(e) => update(i, { min: e.target.value })} className={field} />
                      </label>
                      <label className="text-xs">
                        <span className="mb-0.5 block text-gray-600">מקסימום</span>
                        <input value={f.max} type="number" onChange={(e) => update(i, { max: e.target.value })} className={field} />
                      </label>
                    </>
                  )}
                  <label className="text-xs sm:col-span-2">
                    <span className="mb-0.5 block text-gray-600">טקסט עזרה</span>
                    <input value={f.help} onChange={(e) => update(i, { help: e.target.value })} className={field} />
                  </label>
                </div>

                {earlier.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-600">הצג רק אם</span>
                    <select value={f.showIfField} onChange={(e) => update(i, { showIfField: e.target.value, showIfEquals: '' })} aria-label="שדה תנאי" className="rounded-lg border border-gray-200 bg-white px-2 py-1">
                      <option value="">(תמיד)</option>
                      {earlier.map((x) => (
                        <option key={x.key} value={x.key}>
                          {x.label || x.key}
                        </option>
                      ))}
                    </select>
                    {ref && (
                      <>
                        <span className="text-gray-600">=</span>
                        <select value={f.showIfEquals} onChange={(e) => update(i, { showIfEquals: e.target.value })} aria-label="ערך תנאי" className="rounded-lg border border-gray-200 bg-white px-2 py-1">
                          <option value="">בחרו...</option>
                          {ref.type === 'boolean'
                            ? [['true', 'כן'], ['false', 'לא']].map(([v, l]) => <option key={v} value={v}>{l}</option>)
                            : ref.options.map((o) => <option key={o.value} value={o.value}>{o.label || o.value}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-4">
          <h3 className="font-bold sm:col-span-4">תמחור</h3>
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">מחיר בסיס ליחידה (₪)</span>
            <input value={pricing.basePrice} type="number" step="0.01" min="0" onChange={(e) => setPricing((p) => ({ ...p, basePrice: e.target.value }))} className={field} />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">עלות הקמה להזמנה (₪)</span>
            <input value={pricing.setupFee} type="number" step="0.01" min="0" onChange={(e) => setPricing((p) => ({ ...p, setupFee: e.target.value }))} className={field} />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">כמות מינימום</span>
            <input value={pricing.minQuantity} type="number" min="1" onChange={(e) => setPricing((p) => ({ ...p, minQuantity: e.target.value }))} className={field} />
          </label>
          <label className="flex items-center gap-1.5 self-end pb-2 text-xs">
            <input type="checkbox" checked={pricing.quoteOnly} onChange={(e) => setPricing((p) => ({ ...p, quoteOnly: e.target.checked }))} />
            הצעת מחיר בלבד
          </label>
          <label className="text-xs sm:col-span-4">
            <span className="mb-0.5 block text-gray-600">מדרגות כמות — שורה לכל מדרגה: כמות | מחיר ליחידה</span>
            <textarea value={pricing.tiers} rows={3} dir="ltr" placeholder={'500 | 0.8\n1000 | 0.6'} onChange={(e) => setPricing((p) => ({ ...p, tiers: e.target.value }))} className={`${field} font-mono`} />
          </label>
        </section>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">הערות לגרסה (פנימי)</span>
          <input name="notes" defaultValue={notes ?? ''} className={field} />
        </label>

        {issues.length > 0 && (
          <ul className="list-disc rounded-lg bg-amber-50 p-3 pr-6 text-sm text-amber-800">
            {issues.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Submit label="שמירת טיוטה" />
          <Feedback state={saveState} />
        </div>
      </form>

      <section className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <h3 className="mb-1 font-bold">תצוגה מקדימה — כך המשתלה תראה את הטופס</h3>
        <p className="mb-3 text-xs text-gray-500">התצוגה מבוססת על הנתונים בעורך (גם לפני שמירה).</p>
        {parsedFields.ok ? (
          <div className="max-w-md space-y-4 rounded-lg bg-white p-4">
            <TemplateFields fields={parsedFields.value} values={preview} onChange={(k, v) => setPreview((p) => ({ ...p, [k]: v }))} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">כמות</span>
              <input value={qty} type="number" min="1" onChange={(e) => setQty(e.target.value)} className={field} />
            </label>
            {previewPrice && <p className="text-sm font-medium">{previewPrice}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">תקנו את השגיאות בשדות כדי לראות תצוגה מקדימה.</p>
        )}
      </section>

      <form action={pubAction} className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
        <input type="hidden" name="id" value={templateId} />
        <Submit label={`פרסום גרסה ${version}`} pendingLabel="מפרסם..." tone="dark" />
        <span className="text-xs text-gray-500">הפרסום משתמש בטיוטה השמורה. אחרי פרסום — הגרסה נעולה; שינויים ייעשו בגרסה חדשה.</span>
        <Feedback state={pubState} />
      </form>
    </div>
  );
}
