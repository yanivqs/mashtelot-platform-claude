'use client';

import { isVisible, type RawValues, type TemplateField } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

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
    <div className="space-y-4">
      {fields
        .filter((f) => isVisible(f, fields, values))
        .map((f) => {
          const id = `pf-${f.key}`;
          const err = errors[f.key];
          const label = (
            <span className="mb-1 block font-medium text-gray-700">
              {f.label}
              {f.required && <span className="text-rose-600"> *</span>}
            </span>
          );
          const delta = (d: number) => (d ? ` (${d > 0 ? '+' : ''}${formatPrice(d)} ליח׳)` : '');
          let control: React.ReactNode;
          switch (f.type) {
            case 'text':
              control = (
                <input id={id} value={String(values[f.key] ?? '')} maxLength={f.maxLength ?? 120} onChange={(e) => onChange(f.key, e.target.value)} className={input} />
              );
              break;
            case 'textarea':
              control = (
                <textarea id={id} rows={3} value={String(values[f.key] ?? '')} maxLength={f.maxLength ?? 2000} onChange={(e) => onChange(f.key, e.target.value)} className={input} />
              );
              break;
            case 'number':
              control = (
                <input id={id} type="number" min={f.min} max={f.max} value={String(values[f.key] ?? '')} onChange={(e) => onChange(f.key, e.target.value)} className={input} />
              );
              break;
            case 'select':
              control = (
                <select id={id} value={String(values[f.key] ?? '')} onChange={(e) => onChange(f.key, e.target.value)} className={`${input} bg-white`}>
                  <option value="">בחרו...</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                      {delta(o.priceDelta)}
                    </option>
                  ))}
                </select>
              );
              break;
            case 'multiselect': {
              const sel = new Set(Array.isArray(values[f.key]) ? (values[f.key] as string[]) : []);
              control = (
                <div className="flex flex-wrap gap-3">
                  {f.options?.map((o) => (
                    <label key={o.value} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={sel.has(o.value)}
                        onChange={(e) => {
                          const next = new Set(sel);
                          if (e.target.checked) next.add(o.value);
                          else next.delete(o.value);
                          onChange(f.key, [...next]);
                        }}
                      />
                      {o.label}
                      {delta(o.priceDelta)}
                    </label>
                  ))}
                </div>
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
                  {f.help && <p className="mt-1 text-xs text-gray-500">{f.help}</p>}
                  {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
                </div>
              );
          }
          return (
            <div key={f.key} className="text-sm">
              {f.type === 'multiselect' ? label : <label htmlFor={id}>{label}</label>}
              {control}
              {f.help && <p className="mt-1 text-xs text-gray-500">{f.help}</p>}
              {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
            </div>
          );
        })}
    </div>
  );
}
