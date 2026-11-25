'use client';

import { CHOICE_FIELDS, SEASONS, origInputName, seasonsFromText, type ChoiceField } from '@/lib/plant-options';

/**
 * קלט לשדה בוטני עם אפשרויות מוגדרות מראש (ללא הקלדה חופשית):
 * אור / השקיה — רשימה נפתחת; עונת פריחה — תיבות סימון לעונות.
 * ערך ישן שאינו מהרשימה מוצג כ"ערך קיים" עד שבוחרים אפשרות מהרשימה.
 */
export function PlantChoiceInput({
  field,
  name,
  id,
  value,
  className,
}: {
  field: ChoiceField;
  name: string;
  id: string;
  value: string | null | undefined;
  className: string;
}) {
  const def = CHOICE_FIELDS[field];
  const current = (value ?? '').trim();

  if (def.kind === 'select') {
    const legacy = current && !def.options.includes(current) ? current : null;
    return (
      <>
        <select id={id} name={name} defaultValue={current} className={className}>
          <option value="">— בחרו —</option>
          {legacy && <option value={legacy}>ערך קיים: {legacy}</option>}
          {def.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {legacy && <p className="mt-1 text-xs text-amber-700">הערך הקיים אינו מהרשימה — מומלץ לבחור אפשרות מהרשימה.</p>}
      </>
    );
  }

  const checked = new Set(seasonsFromText(current));
  return (
    <div id={id} role="group" className="flex flex-wrap gap-x-4 gap-y-2 py-1.5">
      {/* שדה ריק באותו שם — כדי שהשדה ייחשב "נשלח" גם כשלא סומנה אף עונה */}
      <input type="hidden" name={name} value="" />
      <input type="hidden" name={origInputName(name)} value={current} />
      {SEASONS.map((s) => (
        <label key={s.key} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name={name}
            value={s.label}
            defaultChecked={checked.has(s.label)}
            className="h-4 w-4 rounded border-gray-300"
          />
          {s.label}
        </label>
      ))}
    </div>
  );
}
