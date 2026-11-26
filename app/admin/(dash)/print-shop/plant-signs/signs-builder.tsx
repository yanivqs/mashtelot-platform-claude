'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Leaf, Plus, Search, Trash2 } from 'lucide-react';
import { SignPreview, SignStyles } from '@/components/plant-sign/sign-preview';
import { TemplateFields } from '@/components/print/template-fields';
import { signFromSource, type SignSource } from '@/lib/plant-sign/source';
import { LIGHT_RANGES, lightKey, lightScale, lightTitle, WATER_AMOUNTS, waterScale, waterTitle } from '@/lib/plant-sign/scales';
import { signDescription, typePhrase } from '@/lib/plant-sign/text';
import type { SignSettings } from '@/lib/plant-sign/types';
import { quotePrint, validateValues, type RawValues, type TemplateField, type TemplatePricing } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import { createPlantSignOrderAction, loadSignSourcesAction, saveSignSettingsAction } from './actions';

export interface CatalogPlant {
  id: string;
  name: string;
  latin: string | null;
  title: string | null;
  image: string | null;
  edited: boolean;
}

interface Line {
  source: SignSource;
  quantity: number;
  settings: SignSettings;
  dirty: boolean;
}

const LIMITS = { description: 320, notes: 140, plantType: 60, note: 90 };
const MAX_COPIES = 1000;

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

export function SignsBuilder({
  catalog,
  initial,
  product,
}: {
  catalog: CatalogPlant[];
  initial: Array<{ source: SignSource; quantity: number }>;
  product: { fields: TemplateField[]; pricing: TemplatePricing; unitLabel: string | null; leadTimeDays: number | null };
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    initial.map((l) => ({ source: l.source, quantity: l.quantity, settings: l.source.settings, dirty: false })),
  );
  const [selected, setSelected] = useState<string | null>(initial[0]?.source.productId ?? null);
  const [query, setQuery] = useState('');
  const [values, setValues] = useState<RawValues>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [done, setDone] = useState<{ quoteOnly: boolean; total: number } | null>(null);
  const [pending, start] = useTransition();

  const chosen = new Set(lines.map((l) => l.source.productId));
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = catalog.filter((c) => !chosen.has(c.id));
    if (!q) return pool;
    return pool.filter((c) => c.name.toLowerCase().includes(q) || c.latin?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, catalog, lines]);

  const current = lines.find((l) => l.source.productId === selected) ?? null;
  const total = lines.reduce((s, l) => s + l.quantity, 0);

  const quote = useMemo(() => {
    if (!total) return null;
    const checked = validateValues(product.fields, values);
    if (!checked.ok) return null;
    const q = quotePrint(product.pricing, product.fields, checked.values, total);
    return q.ok ? q.quote : { error: q.error };
  }, [product, values, total]);

  function addPlants(ids: string[]) {
    setError(null);
    start(async () => {
      const res = await loadSignSourcesAction(ids);
      if (res.error || !res.sources) {
        setError(res.error ?? 'לא ניתן להוסיף את הצמח');
        return;
      }
      setLines((prev) => [
        ...prev,
        ...res
          .sources!.filter((s) => !prev.some((p) => p.source.productId === s.productId))
          .map((s) => ({ source: s, quantity: 1, settings: s.settings, dirty: false })),
      ]);
      if (res.sources[0]) setSelected(res.sources[0].productId);
      setQuery('');
    });
  }

  function update(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.source.productId === id ? { ...l, ...patch } : l)));
  }

  function setSetting(id: string, patch: Partial<SignSettings>) {
    setSaved(null);
    setLines((prev) =>
      prev.map((l) => (l.source.productId === id ? { ...l, settings: clean({ ...l.settings, ...patch }), dirty: true } : l)),
    );
  }

  function remove(id: string) {
    setLines((prev) => {
      const next = prev.filter((l) => l.source.productId !== id);
      if (selected === id) setSelected(next[0]?.source.productId ?? null);
      return next;
    });
  }

  async function saveDirty(list: Line[]): Promise<string | null> {
    for (const l of list.filter((x) => x.dirty)) {
      const r = await saveSignSettingsAction(l.source.productId, l.settings);
      if (r.error) return `${l.source.hebrewName}: ${r.error}`;
    }
    setLines((prev) => prev.map((l) => ({ ...l, dirty: false })));
    return null;
  }

  function saveCurrent() {
    if (!current) return;
    setError(null);
    start(async () => {
      const r = await saveSignSettingsAction(current.source.productId, current.settings);
      if (r.error) setError(r.error);
      else {
        update(current.source.productId, { dirty: false });
        setSaved(current.source.productId);
      }
    });
  }

  function submit() {
    setError(null);
    start(async () => {
      const err = await saveDirty(lines);
      if (err) {
        setError(err);
        return;
      }
      const res = await createPlantSignOrderAction({
        lines: lines.map((l) => ({ productId: l.source.productId, quantity: l.quantity })),
        values,
        notes,
      });
      if (!res.ok) {
        setError(res.error ?? 'ההזמנה לא נשלחה');
        return;
      }
      setDone({ quoteOnly: Boolean(res.quoteOnly), total: res.total ?? 0 });
      setLines([]);
      setSelected(null);
    });
  }

  if (done) {
    return (
      <div className="max-w-xl rounded-xl border border-brand-200 bg-brand-50 p-6" role="status" data-testid="signs-ordered">
        <h2 className="text-lg font-bold text-brand-900">{done.quoteOnly ? 'הבקשה נשלחה לבית הדפוס' : 'ההזמנה התקבלה'}</h2>
        <p className="mt-1 text-sm text-gray-700">
          {done.quoteOnly
            ? 'בית הדפוס יבדוק את ההזמנה וישלח הצעת מחיר.'
            : `סה"כ ${formatPrice(done.total)}. בית הדפוס יכין את השלטים לפי מה שאישרתם.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/admin/print-shop/jobs"
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            העבודות שלי
          </Link>
          <button
            type="button"
            onClick={() => setDone(null)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-white"
          >
            הזמנת שלטים נוספים
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <SignStyles />

      {/* רשימת הצמחים והזמנה */}
      <div className="space-y-6 lg:col-span-5">
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">הצמחים בהזמנה</h2>
          <div className="relative">
            <label htmlFor="sign-search" className="sr-only">
              חיפוש צמח להוספה
            </label>
            <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-500" aria-hidden />
            <input
              id="sign-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש צמח מהמוצרים שלכם…"
              className={`${inputCls} pr-9`}
              data-testid="sign-search"
              autoComplete="off"
            />
          </div>
          <ul className="mt-2 max-h-72 divide-y divide-gray-50 overflow-auto rounded-lg border border-gray-100" aria-label="תוצאות חיפוש">
            {results.length === 0 && (
              <li className="p-3 text-sm text-gray-600">
                {!catalog.length ? 'אין עדיין צמחים במוצרים שלכם' : query ? 'לא נמצאו צמחים' : 'כל הצמחים כבר נוספו'}
              </li>
            )}
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addPlants([c.id])}
                  disabled={pending}
                  className="flex w-full items-center gap-3 p-2 text-right hover:bg-gray-50 disabled:opacity-60"
                  data-testid="sign-add"
                >
                  <Thumb src={c.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    {c.latin && (
                      <span className="block truncate text-xs italic text-gray-600" dir="ltr">
                        {c.latin}
                      </span>
                    )}
                  </span>
                  <Plus className="h-4 w-4 text-brand-700" aria-hidden />
                  <span className="sr-only">הוספה</span>
                </button>
              </li>
            ))}
          </ul>

          {lines.length > 0 && (
            <ul className="mt-4 space-y-2" data-testid="sign-lines">
              {lines.map((l) => {
                const id = l.source.productId;
                const active = id === selected;
                return (
                  <li
                    key={id}
                    className={`flex items-center gap-3 rounded-lg border p-2 ${active ? 'border-brand-600 bg-brand-50' : 'border-gray-100'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-right"
                      aria-pressed={active}
                    >
                      <Thumb src={l.source.imageUrl} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{l.source.hebrewName}</span>
                        {l.dirty && <span className="block text-xs text-amber-700">שינויים שלא נשמרו</span>}
                        {l.source.storeVisible === false && (
                          <span className="block text-xs text-rose-700" data-testid="sign-hidden">
                            מוסתר באתר — ה-QR יעבוד רק אחרי שהמוצר יוצג
                          </span>
                        )}
                      </span>
                    </button>
                    <label className="flex items-center gap-1 text-xs text-gray-700">
                      <span className="sr-only">כמות שלטים ל{l.source.hebrewName}</span>
                      <input
                        type="number"
                        min={1}
                        max={MAX_COPIES}
                        value={l.quantity}
                        onChange={(e) =>
                          update(id, { quantity: Math.max(1, Math.min(MAX_COPIES, Math.trunc(Number(e.target.value)) || 1)) })
                        }
                        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        data-testid="sign-qty"
                      />
                      שלטים
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(id)}
                      className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-rose-700"
                      aria-label={`הסרת ${l.source.hebrewName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-bold">פרטי ההזמנה</h2>
          {product.fields.length > 0 && (
            <div className="mb-4">
              <TemplateFields fields={product.fields} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
            </div>
          )}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-700">צמחים</dt>
              <dd>{lines.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-700">סה&quot;כ שלטים</dt>
              <dd data-testid="signs-total">{total}</dd>
            </div>
            {quote && 'total' in quote && (
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold">
                <dt>{quote.quoteOnly ? 'מחיר' : 'לתשלום'}</dt>
                <dd data-testid="signs-price">{quote.quoteOnly ? 'בהצעת מחיר' : formatPrice(quote.total)}</dd>
              </div>
            )}
            {quote && 'error' in quote && <p className="text-sm text-rose-700">{quote.error}</p>}
            {product.leadTimeDays ? <p className="text-xs text-gray-600">זמן הכנה משוער: {product.leadTimeDays} ימי עבודה</p> : null}
          </dl>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-gray-700">הערות לבית הדפוס (לא חובה)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} className={inputCls} />
          </label>
          {error && (
            <p className="mt-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || lines.length === 0 || !quote || 'error' in quote}
            className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="signs-submit"
          >
            {pending ? 'שולח…' : 'אישור והזמנה'}
          </button>
          <p className="mt-2 text-xs text-gray-600">השלטים יודפסו בדיוק כפי שהם מוצגים כאן. העריכות נשמרות לכל צמח גם להזמנות הבאות.</p>
        </section>
      </div>

      {/* תצוגה מקדימה ועריכה */}
      <div className="lg:col-span-7">
        {current ? (
          <SignEditor
            key={current.source.productId}
            line={current}
            onChange={(patch) => setSetting(current.source.productId, patch)}
            onReset={() => {
              setSaved(null);
              update(current.source.productId, { settings: {}, dirty: true });
            }}
            onSave={saveCurrent}
            saved={saved === current.source.productId}
            pending={pending}
          />
        ) : (
          <div className="flex aspect-[3/2] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
            <Leaf className="h-8 w-8 text-brand-600" aria-hidden />
            בחרו צמח כדי לראות את השלט שלו
          </div>
        )}
      </div>
    </div>
  );
}

/** הסרת ערכים ריקים, כדי שהשדה יחזור לברירת המחדל */
function clean(s: SignSettings): SignSettings {
  const out: SignSettings = {};
  if (s.description?.trim()) out.description = s.description;
  if (s.notes?.trim()) out.notes = s.notes;
  if (s.plantType?.trim()) out.plantType = s.plantType;
  if (s.light && (s.light.range || s.light.note?.trim())) out.light = s.light;
  if (s.water && (s.water.amount || s.water.note?.trim())) out.water = s.water;
  return out;
}

function Thumb({ src }: { src: string | null }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50">
      <Leaf className="h-4 w-4 text-brand-600" aria-hidden />
    </span>
  );
}

function SignEditor({
  line,
  onChange,
  onReset,
  onSave,
  saved,
  pending,
}: {
  line: Line;
  onChange: (patch: Partial<SignSettings>) => void;
  onReset: () => void;
  onSave: () => void;
  saved: boolean;
  pending: boolean;
}) {
  const src = line.source;
  const s = line.settings;
  const data = useMemo(() => signFromSource(src, s), [src, s]);
  const autoDescription = useMemo(
    () => signDescription({ saved: null, productDescription: src.productDescription, plant: src.plant }),
    [src],
  );
  const autoLight = lightScale(src.plant.light, null);
  const autoWater = waterScale(src.plant.water, null);
  const lightNow = lightScale(src.plant.light, s.light ? { range: s.light.range ?? undefined } : null);
  const waterNow = waterScale(src.plant.water, s.water ? { amount: s.water.amount ?? undefined } : null);
  const hasOwnDescription = Boolean(src.productDescription && src.productDescription.replace(/<[^>]*>/g, '').trim().length >= 20);

  return (
    <div className="space-y-4 lg:sticky lg:top-4">
      <SignPreview data={data} uid={`p-${src.productId.slice(0, 8)}`} />

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm" aria-label={`עריכת השלט של ${src.hebrewName}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">עריכת השלט</h2>
          <div className="flex items-center gap-2">
            {saved && !line.dirty && (
              <span className="text-sm text-brand-800" role="status">
                נשמר ✓
              </span>
            )}
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50"
            >
              חזרה לברירת המחדל
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending || !line.dirty}
              className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
              data-testid="sign-save"
            >
              שמירה
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 flex items-center justify-between gap-2 font-medium text-gray-700">
              תיאור
              <span className="text-xs font-normal text-gray-600">
                {(s.description ?? '').length}/{LIMITS.description}
              </span>
            </span>
            <textarea
              value={s.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value.slice(0, LIMITS.description) })}
              rows={4}
              placeholder={autoDescription}
              className={inputCls}
              data-testid="sign-description"
            />
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              {s.description
                ? 'הטקסט שכתבתם יופיע בשלט.'
                : hasOwnDescription
                  ? 'ריק — יוצג התיאור שכתבתם למוצר.'
                  : 'ריק — יוצג תיאור שהורכב אוטומטית מנתוני הצמח.'}
              {!s.description && autoDescription && (
                <button
                  type="button"
                  onClick={() => onChange({ description: autoDescription.slice(0, LIMITS.description) })}
                  className="text-brand-800 underline"
                >
                  להעתיק לעריכה
                </button>
              )}
            </span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">סוג הצמח</span>
            <input
              value={s.plantType ?? ''}
              onChange={(e) => onChange({ plantType: e.target.value.slice(0, LIMITS.plantType) })}
              placeholder={typePhrase(src.plant.plantType) ?? 'למשל: שיח ירוק-עד'}
              className={inputCls}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">הערות</span>
            <input
              value={s.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value.slice(0, LIMITS.notes) })}
              placeholder="ריק — שורות לכתיבה ביד"
              className={inputCls}
              data-testid="sign-notes"
            />
          </label>

          <fieldset className="space-y-2 rounded-lg border border-gray-100 p-3 text-sm">
            <legend className="px-1 font-medium text-gray-700">אור</legend>
            <label className="block">
              <span className="sr-only">רמת האור</span>
              <select
                value={s.light?.range ? lightKey(s.light.range) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const range = v ? (v.split('-').map(Number) as [number, number]) : undefined;
                  onChange({ light: { ...(range ? { range } : {}), note: s.light?.note ?? null } });
                }}
                className={inputCls}
              >
                <option value="">אוטומטי — {autoLight.range ? autoLight.title : 'לא זוהה'}</option>
                {LIGHT_RANGES.map((r) => (
                  <option key={lightKey(r)} value={lightKey(r)}>
                    {lightTitle(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">הסבר על האור</span>
              <input
                value={s.light?.note ?? ''}
                onChange={(e) =>
                  onChange({ light: { ...(s.light?.range ? { range: s.light.range } : {}), note: e.target.value.slice(0, LIMITS.note) } })
                }
                placeholder={lightNow.note}
                className={inputCls}
              />
            </label>
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-gray-100 p-3 text-sm">
            <legend className="px-1 font-medium text-gray-700">השקיה</legend>
            <label className="block">
              <span className="sr-only">כמות ההשקיה</span>
              <select
                value={s.water?.amount ? String(s.water.amount) : ''}
                onChange={(e) => {
                  const amount = e.target.value ? Number(e.target.value) : undefined;
                  onChange({ water: { ...(amount ? { amount } : {}), note: s.water?.note ?? null } });
                }}
                className={inputCls}
              >
                <option value="">אוטומטי — {autoWater.amount ? autoWater.title : 'לא זוהה'}</option>
                {WATER_AMOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {waterTitle(a)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">הסבר על ההשקיה</span>
              <input
                value={s.water?.note ?? ''}
                onChange={(e) =>
                  onChange({
                    water: { ...(s.water?.amount ? { amount: s.water.amount } : {}), note: e.target.value.slice(0, LIMITS.note) },
                  })
                }
                placeholder={waterNow.note}
                className={inputCls}
              />
            </label>
          </fieldset>
        </div>
      </section>
    </div>
  );
}
