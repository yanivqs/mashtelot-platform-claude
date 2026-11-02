'use client';

import { useState } from 'react';
import { CUSTOM_VALUE, customKey, isVisible, type FieldOption, type RawValues, type TemplateField } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const chipBase = 'rounded-lg border px-3 py-2 text-sm font-medium transition-colors';
const chipOn = 'border-brand-600 bg-brand-50 text-brand-800';
const chipOff = 'border-gray-200 bg-white text-gray-700 hover:border-gray-400';

/** הסבר שנפתח בלחיצה — עובד גם במגע ובמקלדת, בלי תלות בריחוף */
export function HelpTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`הסבר: ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="mx-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100"
      >
        ?
      </button>
      {open && <span className="mt-1 block rounded-lg bg-gray-50 p-2 text-xs font-normal text-gray-600">{text}</span>}
    </>
  );
}

function priceHint(o: FieldOption): string {
  const parts: string[] = [];
  if (o.priceDelta) parts.push(`${o.priceDelta > 0 ? '+' : ''}${formatPrice(o.priceDelta)} ליח׳`);
  if (o.fixedAdd) parts.push(`${o.fixedAdd > 0 ? '+' : ''}${formatPrice(o.fixedAdd)}`);
  if (o.percentAdd) parts.push(`${o.percentAdd > 0 ? '+' : ''}${o.percentAdd}%`);
  if (o.minCharge) parts.push(`מינימום ${formatPrice(o.minCharge)}`);
  if (o.minQuantity) parts.push(`מכמות ${o.minQuantity.toLocaleString('he-IL')}`);
  return parts.join(' · ');
}

function Chip({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${chipBase} ${on ? chipOn : chipOff}`}>
      {label}
      {hint && <span className="mr-1.5 text-xs font-normal text-gray-600">{hint}</span>}
    </button>
  );
}

/**
 * שדות תבנית דפוס (PT-03): מציג רק שדות שהתנאי שלהם מתקיים. מבוקר — הערכים אצל ההורה.
 * הסתרה בדפדפן אינה סמכותית: השרת בודק שוב ומשליך שדות מוסתרים.
 */
export function TemplateFields({
  fields,
  values,
  onChange,
  errors = {},
}: {
  fields: TemplateField[];
  values: RawValues;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="space-y-5">
      {fields
        .filter((f) => isVisible(f, fields, values))
        .map((f) => {
          const id = `pf-${f.key}`;
          const err = errors[f.key];
          const label = (
            <span className="font-medium text-gray-700">
              {f.label}
              {f.required && <span className="text-rose-600"> *</span>}
            </span>
          );
          const help = f.help ? <HelpTip text={f.help} label={f.label} /> : null;
          const customInput = (
            <input
              value={String(values[customKey(f.key)] ?? '')}
              maxLength={200}
              aria-label={`${f.label}: התאמה אישית`}
              placeholder="פרטו את הבקשה"
              onChange={(e) => onChange(customKey(f.key), e.target.value)}
              className={`${input} mt-2`}
            />
          );
          let control: React.ReactNode;
          switch (f.type) {
            case 'text':
              control = <input id={id} value={String(values[f.key] ?? '')} maxLength={f.maxLength ?? 120} onChange={(e) => onChange(f.key, e.target.value)} className={input} />;
              break;
            case 'textarea':
              control = <textarea id={id} rows={3} value={String(values[f.key] ?? '')} maxLength={f.maxLength ?? 2000} onChange={(e) => onChange(f.key, e.target.value)} className={input} />;
              break;
            case 'number':
              control = <input id={id} type="number" min={f.min} max={f.max} value={String(values[f.key] ?? '')} onChange={(e) => onChange(f.key, e.target.value)} className={input} />;
              break;
            case 'select': {
              const cur = String(values[f.key] ?? '');
              // לחיצה חוזרת מבטלת את הבחירה, אלא אם השדה חובה
              const pick = (v: string) => onChange(f.key, cur === v && !f.required ? '' : v);
              control = (
                <>
                  <div role="group" aria-label={f.label} className="flex flex-wrap gap-2">
                    {f.options?.map((o) => (
                      <span key={o.value} className="inline-flex items-center">
                        <Chip on={cur === o.value} onClick={() => pick(o.value)} label={o.label} hint={priceHint(o)} />
                        {o.help && <HelpTip text={o.help} label={o.label} />}
                      </span>
                    ))}
                    {f.allowCustom && <Chip on={cur === CUSTOM_VALUE} onClick={() => pick(CUSTOM_VALUE)} label="התאמה אישית" />}
                  </div>
                  {cur === CUSTOM_VALUE && customInput}
                </>
              );
              break;
            }
            case 'multiselect': {
              const sel = new Set(Array.isArray(values[f.key]) ? (values[f.key] as string[]) : []);
              const toggle = (v: string) => {
                const next = new Set(sel);
                if (next.has(v)) next.delete(v);
                else next.add(v);
                onChange(f.key, [...next]);
              };
              control = (
                <>
                  <div role="group" aria-label={f.label} className="flex flex-wrap gap-2">
                    {f.options?.map((o) => (
                      <span key={o.value} className="inline-flex items-center">
                        <Chip on={sel.has(o.value)} onClick={() => toggle(o.value)} label={o.label} hint={priceHint(o)} />
                        {o.help && <HelpTip text={o.help} label={o.label} />}
                      </span>
                    ))}
                    {f.allowCustom && <Chip on={sel.has(CUSTOM_VALUE)} onClick={() => toggle(CUSTOM_VALUE)} label="התאמה אישית" />}
                  </div>
                  {sel.has(CUSTOM_VALUE) && customInput}
                </>
              );
              break;
            }
            case 'boolean':
              return (
                <div key={f.key}>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input id={id} type="checkbox" checked={values[f.key] === true} onChange={(e) => onChange(f.key, e.target.checked)} />
                    {f.label}
                    {f.required && <span className="text-rose-600"> *</span>}
                  </label>
                  {help}
                  {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                </div>
              );
          }
          const grouped = f.type === 'select' || f.type === 'multiselect';
          return (
            <div key={f.key} className="text-sm">
              <div className="mb-1.5">
                {grouped ? label : <label htmlFor={id}>{label}</label>}
                {help}
              </div>
              {control}
              {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
            </div>
          );
        })}
    </div>
  );
}

/** בחירת כמות: כפתורים לפי הכמויות המוגדרות, ו"כמות אחרת" אם מותר. */
export function QuantityPicker({
  options,
  allowCustom,
  min,
  unitLabel,
  quantity,
  onChange,
}: {
  options: number[];
  allowCustom: boolean;
  min: number;
  unitLabel?: string | null;
  quantity: string;
  onChange: (q: string) => void;
}) {
  const isListed = options.includes(Number(quantity));
  return (
    <div className="text-sm">
      <p className="mb-1.5 font-medium text-gray-700">
        כמות{unitLabel ? ` (${unitLabel})` : ''} <span className="text-rose-600">*</span>
      </p>
      {options.length > 0 && (
        <div role="group" aria-label="כמות" className="mb-2 flex flex-wrap gap-2">
          {options.map((q) => (
            <Chip key={q} on={Number(quantity) === q} onClick={() => onChange(String(q))} label={q.toLocaleString('he-IL')} />
          ))}
        </div>
      )}
      {allowCustom && (
        <label className="block max-w-48">
          {options.length > 0 && <span className="mb-1 block text-xs text-gray-600">כמות אחרת</span>}
          <input type="number" min={min} aria-label={options.length > 0 ? 'כמות אחרת' : 'כמות'} value={isListed ? '' : quantity} onChange={(e) => onChange(e.target.value)} className={input} />
        </label>
      )}
      {min > 1 && <p className="mt-1 text-xs text-gray-600">מינימום {min.toLocaleString('he-IL')}</p>}
    </div>
  );
}
