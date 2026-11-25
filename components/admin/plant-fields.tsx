'use client';

import { PlantChoiceInput } from '@/components/admin/plant-choice-input';
import { isChoiceField } from '@/lib/plant-options';
import { PLANT_MAIN_FIELDS, PLANT_MORE_FIELDS, plantInputName, type PlantField, type PlantFieldDef, type PlantFieldValues } from '@/lib/plant-fields';

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-brand-500 sm:text-sm';

export type PlantSuggestions = Partial<Record<PlantField, string[]>>;

/**
 * השדות הבוטניים של צמח (בתוך grid של שתי עמודות): אור, השקיה, פריחה וכו'.
 * אור, השקיה ועונת פריחה — בחירה מאפשרויות מוגדרות מראש (PlantChoiceInput).
 * בשאר השדות שמזינים מסננים בחנות — הצעות מערכי הקטלוג (datalist), ועדיין אפשר להקליד חופשי.
 * `localFields` — שדות ששונו מקומית בצמח מהקטלוג: מסומנים, עם כפתור החזרה לערך הקטלוג.
 */
export function PlantFields({
  values = {},
  suggestions = {},
  localFields = [],
  idPrefix,
}: {
  values?: PlantFieldValues;
  suggestions?: PlantSuggestions;
  localFields?: string[];
  idPrefix: string;
}) {
  const field = (f: PlantFieldDef) => {
    const id = `${idPrefix}-${f.field}`;
    const choice = isChoiceField(f.field) ? f.field : null;
    const list = !choice && f.suggest && suggestions[f.field]?.length ? `${id}-list` : undefined;
    const local = localFields.includes(f.field);
    return (
      <div key={f.field} className={`text-sm ${f.long ? 'sm:col-span-2' : ''}`}>
        <span className="mb-1 flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="font-medium text-gray-700">
            {f.label}
            {f.field === 'hebrewName' ? ' *' : ''}
          </label>
          {local && (
            <>
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800">שונה מקומית</span>
              <button type="submit" name="restoreField" value={f.field} formNoValidate className="text-xs text-brand-700 underline hover:text-brand-800">
                החזר לנתוני הקטלוג
              </button>
            </>
          )}
        </span>
        {choice ? (
          <PlantChoiceInput field={choice} name={plantInputName(f.field)} id={id} value={values[f.field]} className={input} />
        ) : f.long ? (
          <textarea id={id} name={plantInputName(f.field)} rows={3} defaultValue={values[f.field] ?? ''} className={input} />
        ) : (
          <input
            id={id}
            name={plantInputName(f.field)}
            defaultValue={values[f.field] ?? ''}
            placeholder={f.placeholder}
            list={list}
            required={f.field === 'hebrewName'}
            dir={f.field === 'latinName' ? 'ltr' : undefined}
            className={input}
          />
        )}
        {list && (
          <datalist id={list}>
            {suggestions[f.field]!.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        )}
      </div>
    );
  };

  const moreFilled = PLANT_MORE_FIELDS.some((f) => values[f.field] || localFields.includes(f.field));
  return (
    <>
      {PLANT_MAIN_FIELDS.map(field)}
      <details className="text-sm sm:col-span-2" open={moreFilled}>
        <summary className="cursor-pointer font-medium text-gray-700">עוד פרטים (משפחה, מוצא, עמידות...)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">{PLANT_MORE_FIELDS.map(field)}</div>
      </details>
    </>
  );
}
