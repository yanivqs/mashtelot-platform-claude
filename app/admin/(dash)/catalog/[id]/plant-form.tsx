'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { updatePlant, type PlantFormState } from './actions';

const initial: PlantFormState = {};

interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'textarea';
  group: 'זיהוי' | 'מאפיינים' | 'תיאור וטיפול';
}

const FIELDS: FieldDef[] = [
  { name: 'hebrewName', label: 'שם עברי *', group: 'זיהוי' },
  { name: 'latinName', label: 'שם לטיני', group: 'זיהוי' },
  { name: 'nickname', label: 'כינוי', group: 'זיהוי' },
  { name: 'family', label: 'משפחה', group: 'זיהוי' },
  { name: 'plantType', label: 'סוג צמח', group: 'זיהוי' },
  { name: 'origin', label: 'מקור', group: 'זיהוי' },
  { name: 'native', label: 'מקומי / זר', group: 'זיהוי' },
  { name: 'light', label: 'תאורה', group: 'מאפיינים' },
  { name: 'water', label: 'השקיה', group: 'מאפיינים' },
  { name: 'flowering', label: 'פריחה', group: 'מאפיינים' },
  { name: 'floweringSeason', label: 'עונת פריחה', group: 'מאפיינים' },
  { name: 'flowerColor', label: 'צבע פריחה', group: 'מאפיינים' },
  { name: 'foliage', label: 'עלוות', group: 'מאפיינים' },
  { name: 'evergreen', label: 'סבך / עלווה ירוקה', group: 'מאפיינים' },
  { name: 'height', label: 'גובה', group: 'מאפיינים' },
  { name: 'spacing', label: 'מרווח שתילה', group: 'מאפיינים' },
  { name: 'growthRate', label: 'קצב גדילה', group: 'מאפיינים' },
  { name: 'climateZones', label: 'אזורי אקלים', group: 'מאפיינים' },
  { name: 'resistance', label: 'עמידות', group: 'מאפיינים' },
  { name: 'coastal', label: 'עמידות לחוף הים', group: 'מאפיינים' },
  { name: 'description', label: 'תיאור', type: 'textarea', group: 'תיאור וטיפול' },
  { name: 'care', label: 'הנחיות טיפול', type: 'textarea', group: 'תיאור וטיפול' },
  { name: 'uniqueness', label: 'ייחודיות', type: 'textarea', group: 'תיאור וטיפול' },
  { name: 'notes', label: 'הערות', type: 'textarea', group: 'תיאור וטיפול' },
];

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירת שינויים'}
    </button>
  );
}

export function PlantForm({
  plant,
  categories = [],
  selectedCategoryIds = [],
}: {
  plant: Record<string, string | null> & { id: string };
  categories?: Array<{ id: string; name: string; depth: number }>;
  selectedCategoryIds?: string[];
}) {
  const [state, formAction] = useFormState(updatePlant, initial);
  const [imageUrl, setImageUrl] = useState(plant.imageUrl ?? '');

  const groups = ['זיהוי', 'מאפיינים', 'תיאור וטיפול'] as const;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={plant.id} />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <ImageUpload
          name="imageUrl"
          defaultValue={plant.imageUrl}
          label="תמונת הצמח (משותפת לכל המשתלות שמוכרות אותו)"
          folder="plants"
          onChange={setImageUrl}
        />
        {!imageUrl ? (
          <p className="mt-2 text-xs text-amber-800">
            אין תמונה לצמח. מוצרים בלי תמונה מדורגים נמוך בתוצאות החיפוש — העלו תמונה.
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-800">
            שימו לב: התמונה משותפת לכל המשתלות. תמונה כללית או חלשה עלולה להוביל לדירוג נמוך בחיפוש
            אצל משתלות שלא החליפו אותה בתמונה משלהן. תמונה איכותית וברורה משפרת את הדירוג.
          </p>
        )}
      </div>

      {groups.map((group) => (
        <fieldset key={group}>
          <legend className="mb-3 border-b border-gray-100 pb-1 text-sm font-bold text-gray-900">
            {group}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.filter((f) => f.group === group).map((f) => (
              <label
                key={f.name}
                className={`text-sm ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}
              >
                <span className="mb-1 block font-medium text-gray-700">{f.label}</span>
                {f.type === 'textarea' ? (
                  <textarea name={f.name} rows={3} defaultValue={plant[f.name] ?? ''} className={field} />
                ) : (
                  <input name={f.name} defaultValue={plant[f.name] ?? ''} className={field} />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {categories.length > 0 && (
        <fieldset>
          <legend className="mb-3 border-b border-gray-100 pb-1 text-sm font-bold text-gray-900">
            קטגוריות (ברמת הקטלוג המרכזי)
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm"
                style={{ paddingInlineStart: `${c.depth}rem` }}
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={c.id}
                  defaultChecked={selectedCategoryIds.includes(c.id)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
