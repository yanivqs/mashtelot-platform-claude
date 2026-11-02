'use client';

import { useActionState, useMemo, useRef, useState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import { ArrowDown, ArrowUp, Copy, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';
import { TemplateFields } from '@/components/print/template-fields';
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  SIZE_KEY,
  parseFields,
  parsePricing,
  quotePrint,
  validateValues,
  type FieldType,
  type RawValues,
} from '@/lib/print-template';
import { parseProfile } from '@/lib/print-preflight';
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
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="flex flex-wrap items-center gap-3">
      <input name="title" placeholder='למשל: מדבקות לעציצים' aria-label="שם המוצר" className={`${field} max-w-sm`} />
      <Submit label="יצירה" pendingLabel="יוצר..." />
      <Feedback state={state} />
    </form>
  );
}

export interface MetaValues {
  id: string;
  title: string;
  slug: string | null;
  galleryImages: string[];
  sortOrder: number;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  unitLabel: string | null;
  leadTimeDays: number | null;
  requiresArtwork: boolean;
  isActive: boolean;
}

function GalleryEditor({ initialImages }: { initialImages: string[] }) {
  const [images, setImages] = useState(initialImages);
  // ImageUpload שומר את הכתובת במצב פנימי; החלפת המפתח מאפסת אותו אחרי כל הוספה
  const [slot, setSlot] = useState(0);
  return (
    <div className="text-sm sm:col-span-2">
      <input type="hidden" name="galleryImages" value={JSON.stringify(images)} />
      <span className="mb-1 block font-medium text-gray-700">גלריית תמונות לדף המוצר</span>
      {images.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {images.map((src) => (
            <li key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button type="button" aria-label="הסרת תמונה מהגלריה" onClick={() => setImages((p) => p.filter((x) => x !== src))} className="absolute -left-1 -top-1 rounded-full bg-white p-0.5 text-red-600 shadow">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ImageUpload
        key={slot}
        folder="misc"
        hint="מומלץ 1200×900"
        onChange={(url) => {
          if (!url) return;
          setImages((p) => (p.includes(url) ? p : [...p, url]));
          setSlot((n) => n + 1);
        }}
      />
    </div>
  );
}

export function MetaForm({ meta }: { meta: MetaValues }) {
  const [state, action] = useActionState(updateTemplateMetaAction, initial);
  const keep1 = useKeepFormValues(state);
  return (
    <form ref={keep1} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={meta.id} />
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם המוצר</span>
        <input name="title" defaultValue={meta.title} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">כתובת המוצר (באנגלית)</span>
        <input name="slug" dir="ltr" defaultValue={meta.slug ?? ''} placeholder="pot-stickers" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קטגוריה</span>
        <input name="category" defaultValue={meta.category ?? ''} placeholder="תוויות / שילוט / מיתוג" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">סדר בקטלוג</span>
        <input name="sortOrder" type="number" min="0" defaultValue={meta.sortOrder} className={field} />
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
        <ImageUpload name="imageUrl" defaultValue={meta.imageUrl} label="תמונה ראשית" folder="misc" hint="מומלץ 1200×900" />
      </div>
      <GalleryEditor initialImages={meta.galleryImages} />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input name="requiresArtwork" type="checkbox" defaultChecked={meta.requiresArtwork} className="h-4 w-4" />
        נדרשת גרפיקה מאושרת לפני שחרור לייצור
      </label>
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
  help: string;
  priceDelta: string;
  fixedAdd: string;
  percentAdd: string;
  requiresQuote: boolean;
}
interface EditField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  allowCustom: boolean;
  help: string;
  maxLength: string;
  min: string;
  max: string;
  options: EditOption[];
  showIfField: string;
  showIfEquals: string;
}

const blankField = (key: string): EditField => ({
  key,
  label: '',
  type: 'select',
  required: false,
  allowCustom: false,
  help: '',
  maxLength: '',
  min: '',
  max: '',
  options: [],
  showIfField: '',
  showIfEquals: '',
});

const blankOption = (value: string): EditOption => ({ value, label: '', help: '', priceDelta: '0', fixedAdd: '0', percentAdd: '0', requiresQuote: false });

/** מפתח פנימי שלא קיים: המנהל לא מקליד מפתחות. */
const nextKey = (prefix: string, taken: string[]) => {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
};

function toEdit(raw: unknown[]): EditField[] {
  return raw.map((r, i) => {
    const f = (r ?? {}) as Record<string, unknown>;
    const showIf = (f.showIf ?? {}) as Record<string, unknown>;
    return {
      ...blankField(`field_${i + 1}`),
      key: String(f.key ?? ''),
      label: String(f.label ?? ''),
      type: (FIELD_TYPES as readonly string[]).includes(String(f.type)) ? (f.type as FieldType) : 'text',
      required: f.required === true,
      allowCustom: f.allowCustom === true,
      help: String(f.help ?? ''),
      maxLength: f.maxLength === undefined ? '' : String(f.maxLength),
      min: f.min === undefined ? '' : String(f.min),
      max: f.max === undefined ? '' : String(f.max),
      options: Array.isArray(f.options)
        ? f.options.map((o) => {
            const oo = (o ?? {}) as Record<string, unknown>;
            return {
              value: String(oo.value ?? ''),
              label: String(oo.label ?? ''),
              help: String(oo.help ?? ''),
              priceDelta: String(oo.priceDelta ?? 0),
              fixedAdd: String(oo.fixedAdd ?? 0),
              percentAdd: String(oo.percentAdd ?? 0),
              requiresQuote: oo.requiresQuote === true,
            };
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
      ? {
          allowCustom: f.allowCustom,
          options: f.options.map((o) => ({
            value: o.value.trim(),
            label: o.label.trim() || o.value.trim(),
            priceDelta: Number(o.priceDelta || 0),
            ...(Number(o.fixedAdd) ? { fixedAdd: Number(o.fixedAdd) } : {}),
            ...(Number(o.percentAdd) ? { percentAdd: Number(o.percentAdd) } : {}),
            ...(o.requiresQuote ? { requiresQuote: true } : {}),
            ...(o.help.trim() ? { help: o.help.trim() } : {}),
          })),
        }
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
  quantityOptions?: number[];
  allowCustomQuantity?: boolean;
}

type Tab = 'general' | 'fields' | 'pricing' | 'file';
const TABS: Array<[Tab, string]> = [
  ['general', 'כללי'],
  ['fields', 'שדות אפיון'],
  ['pricing', 'כמויות ותמחור'],
  ['file', 'בדיקת קובץ'],
];

export function DraftEditor({
  templateId,
  version,
  initialFields,
  initialPricing,
  initialProduction,
  notes,
  general,
}: {
  templateId: string;
  version: number;
  initialFields: unknown[];
  initialPricing: PricingValues;
  initialProduction: { widthMm?: number; heightMm?: number; bleedMm?: number; minDpi?: number } | null;
  notes: string | null;
  /** טופס פרטי המוצר — טופס נפרד, ולכן מחוץ לטופס הטיוטה */
  general: React.ReactNode;
}) {
  const [saveState, saveAction] = useActionState(saveDraftAction, initial);
  const keep2 = useKeepFormValues(saveState);
  const [pubState, pubAction] = useActionState(publishDraftAction, initial);
  const [tab, setTab] = useState<Tab>('fields');
  const [fields, setFields] = useState<EditField[]>(() => toEdit(initialFields));
  const [pricing, setPricing] = useState({
    basePrice: String(initialPricing.basePrice ?? 0),
    setupFee: String(initialPricing.setupFee ?? 0),
    minQuantity: String(initialPricing.minQuantity ?? 1),
    quoteOnly: initialPricing.quoteOnly === true,
    allowCustomQuantity: initialPricing.allowCustomQuantity !== false,
  });
  const [quantities, setQuantities] = useState<string[]>((initialPricing.quantityOptions ?? []).map(String));
  const [tiers, setTiers] = useState<Array<{ minQty: string; unitPrice: string }>>((initialPricing.tiers ?? []).map((t) => ({ minQty: String(t.minQty), unitPrice: String(t.unitPrice) })));
  const [prod, setProd] = useState({
    widthMm: String(initialProduction?.widthMm ?? ''),
    heightMm: String(initialProduction?.heightMm ?? ''),
    bleedMm: String(initialProduction?.bleedMm ?? ''),
    minDpi: String(initialProduction?.minDpi ?? ''),
  });
  const productionJson =
    prod.widthMm || prod.heightMm
      ? { widthMm: prod.widthMm, heightMm: prod.heightMm, ...(prod.bleedMm ? { bleedMm: prod.bleedMm } : {}), ...(prod.minDpi ? { minDpi: prod.minDpi } : {}) }
      : null;
  const parsedProduction = parseProfile(productionJson);
  const [preview, setPreview] = useState<RawValues>({});
  const [qty, setQty] = useState('');
  const dragFrom = useRef<number | null>(null);

  const fieldsJson = useMemo(() => toJson(fields), [fields]);
  const pricingJson = useMemo(
    () => ({
      basePrice: Number(pricing.basePrice || 0),
      setupFee: Number(pricing.setupFee || 0),
      minQuantity: Number(pricing.minQuantity || 1),
      quoteOnly: pricing.quoteOnly,
      allowCustomQuantity: pricing.allowCustomQuantity,
      quantityOptions: quantities.filter((q) => q.trim()).map(Number),
      tiers: tiers.filter((t) => t.minQty && t.unitPrice).map((t) => ({ minQty: Number(t.minQty), unitPrice: Number(t.unitPrice) })),
    }),
    [pricing, quantities, tiers],
  );
  const parsedFields = parseFields(fieldsJson);
  const parsedPricing = parsePricing(pricingJson);
  const issues = [
    ...(parsedFields.ok ? [] : parsedFields.errors),
    ...(parsedPricing.ok ? [] : parsedPricing.errors),
    ...(parsedProduction.ok ? [] : parsedProduction.errors),
  ];

  const update = (i: number, patch: Partial<EditField>) => setFields((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const moveTo = (from: number, to: number) =>
    setFields((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  const duplicate = (i: number) =>
    setFields((prev) => {
      const src = prev[i]!;
      const taken = prev.map((f) => f.key);
      const copy: EditField = { ...src, key: nextKey('field', taken), label: `${src.label} (עותק)`, options: src.options.map((o) => ({ ...o })) };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  const remove = (i: number) => {
    const key = fields[i]!.key;
    const dependents = fields.filter((f) => f.showIfField === key);
    if (dependents.length && !window.confirm(`השדות ${dependents.map((d) => d.label || d.key).join(', ')} מוצגים לפי השדה הזה. למחוק? התנאי שלהם יוסר.`)) return;
    setFields((prev) => prev.filter((_, j) => j !== i).map((f) => (f.showIfField === key ? { ...f, showIfField: '', showIfEquals: '' } : f)));
  };
  /** סימון שדה המידה: המפתח השמור עובר אליו, ותנאים שמפנים אליו מתעדכנים */
  const setSizeField = (i: number, on: boolean) =>
    setFields((prev) => {
      const taken = prev.map((f) => f.key);
      const rename = new Map<string, string>();
      const next = prev.map((f, j) => {
        let key = f.key;
        if (j === i && on) key = SIZE_KEY;
        else if (f.key === SIZE_KEY) key = nextKey('field', taken);
        if (key !== f.key) rename.set(f.key, key);
        return { ...f, key };
      });
      return next.map((f) => (rename.has(f.showIfField) ? { ...f, showIfField: rename.get(f.showIfField)! } : f));
    });

  // תצוגה מקדימה: אותו טופס שהמשתלה תראה, ואותו חישוב מחיר (מחושב שוב בשרת בהזמנה)
  let previewPrice: string | null = null;
  if (parsedFields.ok && parsedPricing.ok && qty) {
    const v = validateValues(parsedFields.value, preview);
    const q = v.ok ? quotePrint(parsedPricing.value, parsedFields.value, v.values, Number(qty)) : null;
    previewPrice = !v.ok ? 'יש שדות חובה או ערכים לא תקינים' : q && q.ok ? (q.quote.quoteOnly ? `בדיקת צוות: ${q.quote.reasons.join(' · ')}` : `${formatPrice(q.quote.total)} (${formatPrice(q.quote.perUnit)} ליח׳)`) : q && !q.ok ? q.error : null;
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="עריכת מוצר" className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? 'border-brand-600 text-brand-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {label}
          </button>
        ))}
      </div>

      <div hidden={tab !== 'general'}>{general}</div>

      {/* הטופס נשאר בדף גם בלשונית "כללי", כדי שלא יאבדו ערכים שעוד לא נשמרו */}
      <form ref={keep2} action={saveAction} hidden={tab === 'general'} className="space-y-5">
        <input type="hidden" name="id" value={templateId} />
        <input type="hidden" name="fields" value={JSON.stringify(fieldsJson)} />
        <input type="hidden" name="pricing" value={JSON.stringify(pricingJson)} />
        <input type="hidden" name="production" value={JSON.stringify(productionJson)} />

        <section hidden={tab !== 'fields'} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">שדות (טיוטה, גרסה {version})</h3>
            <button type="button" onClick={() => setFields((p) => [...p, blankField(nextKey('field', p.map((f) => f.key)))])} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              <Plus className="h-4 w-4" /> הוספת שדה
            </button>
          </div>
          {fields.length === 0 && <p className="text-sm text-gray-600">אין שדות. הוסיפו שדות שהמשתלה תמלא (חומר, גודל, גימור וכו׳).</p>}
          {fields.map((f, i) => {
            const earlier = fields.slice(0, i).filter((x) => ['select', 'multiselect', 'boolean'].includes(x.type) && x.key);
            const ref = earlier.find((x) => x.key === f.showIfField);
            const isChoice = f.type === 'select' || f.type === 'multiselect';
            return (
              <div
                key={f.key}
                data-testid="template-field-card"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom.current !== null) moveTo(dragFrom.current, i);
                  dragFrom.current = null;
                }}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    draggable
                    aria-hidden
                    data-testid="field-drag-handle"
                    onDragStart={(e) => {
                      dragFrom.current = i;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(i));
                    }}
                    className="hidden cursor-grab text-gray-500 sm:inline"
                  >
                    <GripVertical className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-medium text-gray-600">שדה {i + 1}</span>
                  <span className="mr-auto flex gap-1">
                    <button type="button" aria-label={`הזזת שדה ${i + 1} למעלה`} onClick={() => moveTo(i, i - 1)} className="rounded p-1 text-gray-600 hover:bg-gray-100"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`הזזת שדה ${i + 1} למטה`} onClick={() => moveTo(i, i + 1)} className="rounded p-1 text-gray-600 hover:bg-gray-100"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`שכפול שדה ${i + 1}`} onClick={() => duplicate(i)} className="rounded p-1 text-gray-600 hover:bg-gray-100"><Copy className="h-4 w-4" /></button>
                    <button type="button" aria-label={`מחיקת שדה ${i + 1}`} onClick={() => remove(i)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </span>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <label className="text-xs">
                    <span className="mb-0.5 block text-gray-600">שם השדה</span>
                    <input value={f.label} onChange={(e) => update(i, { label: e.target.value })} aria-label={`שם שדה ${i + 1}`} className={field} />
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
                  <label className="text-xs">
                    <span className="mb-0.5 block text-gray-600">הסבר (מוצג ב-"?")</span>
                    <input value={f.help} onChange={(e) => update(i, { help: e.target.value })} aria-label={`הסבר לשדה ${i + 1}`} className={field} />
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={f.required} aria-label={`שדה ${i + 1} חובה`} onChange={(e) => update(i, { required: e.target.checked })} />
                    חובה
                  </label>
                  {isChoice && (
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={f.allowCustom} aria-label={`שדה ${i + 1} התאמה אישית`} onChange={(e) => update(i, { allowCustom: e.target.checked })} />
                      אפשר התאמה אישית
                    </label>
                  )}
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={f.key === SIZE_KEY} aria-label={`שדה ${i + 1} הוא שדה המידה`} onChange={(e) => setSizeField(i, e.target.checked)} />
                    זה שדה המידה (לבדיקת רזולוציה, למשל A4 או 10x15)
                  </label>
                </div>

                {isChoice && (
                  <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-2">
                    <span className="text-xs font-medium text-gray-700">אפשרויות</span>
                    {f.options.map((o, k) => {
                      const setOpt = (patch: Partial<EditOption>) => update(i, { options: f.options.map((x, m) => (m === k ? { ...x, ...patch } : x)) });
                      return (
                        <div key={o.value} className="grid items-end gap-2 rounded-lg bg-white p-2 sm:grid-cols-[1.4fr_1.4fr_repeat(3,5rem)_auto_auto]">
                          <label className="text-xs">
                            <span className="mb-0.5 block text-gray-600">שם</span>
                            <input value={o.label} placeholder="למשל: כרומו" aria-label={`שם אפשרות ${k + 1} בשדה ${i + 1}`} onChange={(e) => setOpt({ label: e.target.value })} className={field} />
                          </label>
                          <label className="text-xs">
                            <span className="mb-0.5 block text-gray-600">הסבר</span>
                            <input value={o.help} onChange={(e) => setOpt({ help: e.target.value })} className={field} />
                          </label>
                          <label className="text-xs">
                            <span className="mb-0.5 block text-gray-600">קבועה ₪</span>
                            <input value={o.fixedAdd} type="number" step="0.01" aria-label={`תוספת קבועה לאפשרות ${k + 1}`} onChange={(e) => setOpt({ fixedAdd: e.target.value })} className={field} />
                          </label>
                          <label className="text-xs">
                            <span className="mb-0.5 block text-gray-600">ליחידה ₪</span>
                            <input value={o.priceDelta} type="number" step="0.01" aria-label={`תוספת ליחידה לאפשרות ${k + 1}`} onChange={(e) => setOpt({ priceDelta: e.target.value })} className={field} />
                          </label>
                          <label className="text-xs">
                            <span className="mb-0.5 block text-gray-600">אחוזים %</span>
                            <input value={o.percentAdd} type="number" step="0.1" aria-label={`תוספת אחוזים לאפשרות ${k + 1}`} onChange={(e) => setOpt({ percentAdd: e.target.value })} className={field} />
                          </label>
                          <label className="flex items-center gap-1 pb-2 text-xs">
                            <input type="checkbox" checked={o.requiresQuote} aria-label={`אפשרות ${k + 1} דורשת הצעה`} onChange={(e) => setOpt({ requiresQuote: e.target.checked })} />
                            דורש הצעה
                          </label>
                          <button type="button" aria-label={`מחיקת אפשרות ${k + 1}`} onClick={() => update(i, { options: f.options.filter((_, m) => m !== k) })} className="mb-1 rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      );
                    })}
                    <button type="button" onClick={() => update(i, { options: [...f.options, blankOption(nextKey('opt', f.options.map((o) => o.value)))] })} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                      <Plus className="h-3.5 w-3.5" /> הוספת אפשרות
                    </button>
                  </div>
                )}

                {(f.type === 'text' || f.type === 'textarea') && (
                  <label className="mt-2 block max-w-40 text-xs">
                    <span className="mb-0.5 block text-gray-600">אורך מקסימלי</span>
                    <input value={f.maxLength} type="number" min="1" onChange={(e) => update(i, { maxLength: e.target.value })} className={field} />
                  </label>
                )}
                {f.type === 'number' && (
                  <div className="mt-2 flex gap-2">
                    <label className="max-w-32 text-xs">
                      <span className="mb-0.5 block text-gray-600">מינימום</span>
                      <input value={f.min} type="number" onChange={(e) => update(i, { min: e.target.value })} className={field} />
                    </label>
                    <label className="max-w-32 text-xs">
                      <span className="mb-0.5 block text-gray-600">מקסימום</span>
                      <input value={f.max} type="number" onChange={(e) => update(i, { max: e.target.value })} className={field} />
                    </label>
                  </div>
                )}

                {earlier.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-gray-600">הצג רק אם</span>
                    <select value={f.showIfField} onChange={(e) => update(i, { showIfField: e.target.value, showIfEquals: '' })} aria-label={`שדה תנאי לשדה ${i + 1}`} className="rounded-lg border border-gray-200 bg-white px-2 py-1">
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
                        <select value={f.showIfEquals} onChange={(e) => update(i, { showIfEquals: e.target.value })} aria-label={`ערך תנאי לשדה ${i + 1}`} className="rounded-lg border border-gray-200 bg-white px-2 py-1">
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

        <section hidden={tab !== 'pricing'} className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
          <h3 className="font-bold">כמויות ותמחור</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">עלות הקמה להזמנה (₪)</span>
              <input value={pricing.setupFee} type="number" step="0.01" min="0" onChange={(e) => setPricing((p) => ({ ...p, setupFee: e.target.value }))} className={field} />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">כמות מינימום</span>
              <input value={pricing.minQuantity} type="number" min="1" onChange={(e) => setPricing((p) => ({ ...p, minQuantity: e.target.value }))} className={field} />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">מחיר ליחידה מתחת למדרגות (₪, לא חובה)</span>
              <input value={pricing.basePrice} type="number" step="0.01" min="0" onChange={(e) => setPricing((p) => ({ ...p, basePrice: e.target.value }))} className={field} />
            </label>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={pricing.quoteOnly} onChange={(e) => setPricing((p) => ({ ...p, quoteOnly: e.target.checked }))} />
              תמיד דורש הצעת צוות
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={pricing.allowCustomQuantity} onChange={(e) => setPricing((p) => ({ ...p, allowCustomQuantity: e.target.checked }))} />
              אפשר כמות חופשית
            </label>
          </div>

          {pricing.quoteOnly && (tiers.length > 0 || Number(pricing.basePrice) > 0) && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900" data-testid="quote-only-warning">
              מסומן &quot;תמיד דורש הצעת צוות&quot;: המשתלות לא יקבלו מחיר מיידי, גם אם הוגדרו כאן מחירים. כדי לתת מחיר מיידי, בטלו את הסימון.
            </p>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-gray-700">כמויות מוגדרות (כפתורים בהזמנה). כמות אחרת עוברת לבדיקת צוות.</p>
            <div className="flex flex-wrap items-center gap-2">
              {quantities.map((q, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <input value={q} type="number" min="1" aria-label={`כמות מוגדרת ${i + 1}`} onChange={(e) => setQuantities((p) => p.map((x, j) => (j === i ? e.target.value : x)))} className={`${field} w-24`} />
                  <button type="button" aria-label={`מחיקת כמות ${i + 1}`} onClick={() => setQuantities((p) => p.filter((_, j) => j !== i))} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </span>
              ))}
              <button type="button" onClick={() => setQuantities((p) => [...p, ''])} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                <Plus className="h-3.5 w-3.5" /> הוספת כמות
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-gray-700">מדרגות מחיר</p>
            {tiers.length > 0 && (
              <div className="mb-2 max-w-md space-y-2">
                {tiers.map((t, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <label className="flex-1 text-xs">
                      <span className="mb-0.5 block text-gray-600">מכמות</span>
                      <input value={t.minQty} type="number" min="1" aria-label={`מדרגה ${i + 1}: מכמות`} onChange={(e) => setTiers((p) => p.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)))} className={field} />
                    </label>
                    <label className="flex-1 text-xs">
                      <span className="mb-0.5 block text-gray-600">מחיר ליחידה ₪</span>
                      <input value={t.unitPrice} type="number" step="0.001" min="0" aria-label={`מדרגה ${i + 1}: מחיר`} onChange={(e) => setTiers((p) => p.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} className={field} />
                    </label>
                    <button type="button" aria-label={`מחיקת מדרגה ${i + 1}`} onClick={() => setTiers((p) => p.filter((_, j) => j !== i))} className="mb-1 rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setTiers((p) => [...p, { minQty: '', unitPrice: '' }])} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
              <Plus className="h-3.5 w-3.5" /> הוספת מדרגה
            </button>
          </div>
        </section>

        <section hidden={tab !== 'file'} className="rounded-lg border border-gray-200 bg-white p-3">
          <h3 className="font-bold">פרופיל ייצור (לבדיקת קבצים)</h3>
          <p className="mb-3 mt-1 text-xs text-gray-600">
            גודל המוצר הסופי. קובץ גרפיקה וקובץ ייצור ייבדקו מול המידות והרזולוציה; קובץ ייצור שנכשל בבדיקה קריטית לא ישוחרר. ריק: ללא בדיקת מידות. אם סימנתם שדה מידה, הרזולוציה בהזמנה נבדקת לפיו.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">רוחב (מ"מ)</span>
              <input value={prod.widthMm} type="number" step="0.1" min="0" aria-label="רוחב המוצר במ״מ" onChange={(e) => setProd((p) => ({ ...p, widthMm: e.target.value }))} className={field} />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">גובה (מ"מ)</span>
              <input value={prod.heightMm} type="number" step="0.1" min="0" aria-label="גובה המוצר במ״מ" onChange={(e) => setProd((p) => ({ ...p, heightMm: e.target.value }))} className={field} />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">גלישה (מ"מ, לכל צד)</span>
              <input value={prod.bleedMm} type="number" step="0.5" min="0" placeholder="0" aria-label="גלישה במ״מ" onChange={(e) => setProd((p) => ({ ...p, bleedMm: e.target.value }))} className={field} />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">רזולוציה מינימלית (DPI)</span>
              <input value={prod.minDpi} type="number" min="72" placeholder="300" aria-label="רזולוציה מינימלית" onChange={(e) => setProd((p) => ({ ...p, minDpi: e.target.value }))} className={field} />
            </label>
          </div>
        </section>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">הערות לגרסה (פנימי)</span>
          <input name="notes" defaultValue={notes ?? ''} className={field} />
        </label>

        {issues.length > 0 && (
          <ul className="list-disc rounded-lg bg-amber-50 p-3 pr-6 text-sm text-amber-900">
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
        <h3 className="mb-1 font-bold">תצוגה מקדימה: כך המשתלה תראה את הטופס</h3>
        <p className="mb-3 text-xs text-gray-600">התצוגה מבוססת על הנתונים בעורך (גם לפני שמירה).</p>
        {parsedFields.ok ? (
          <div className="max-w-md space-y-4 rounded-lg bg-white p-4">
            <TemplateFields fields={parsedFields.value} values={preview} onChange={(k, v) => setPreview((p) => ({ ...p, [k]: v }))} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">כמות</span>
              <input value={qty} type="number" min="1" onChange={(e) => setQty(e.target.value)} className={field} />
            </label>
            {previewPrice && <p className="text-sm font-medium" data-testid="template-preview-price">{previewPrice}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-600">תקנו את השגיאות בשדות כדי לראות תצוגה מקדימה.</p>
        )}
      </section>

      <form action={pubAction} className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4">
        <input type="hidden" name="id" value={templateId} />
        <Submit label={`פרסום גרסה ${version}`} pendingLabel="מפרסם..." tone="dark" />
        <span className="text-xs text-gray-600">הפרסום משתמש בטיוטה השמורה. אחרי פרסום הגרסה נעולה; שינויים ייעשו בגרסה חדשה.</span>
        <Feedback state={pubState} />
      </form>
    </div>
  );
}
