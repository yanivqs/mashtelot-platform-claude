'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { updatePlant, type PlantFormState } from './actions';

const initial: PlantFormState = {};

const FIELDS: Array<{ name: string; label: string; type?: 'text' | 'textarea' }> = [
  { name: 'hebrewName', label: 'שם עברי' },
  { name: 'latinName', label: 'שם לטיני' },
  { name: 'nickname', label: 'כינוי' },
  { name: 'family', label: 'משפחה' },
  { name: 'plantType', label: 'סוג צמח' },
  { name: 'light', label: 'תאורה' },
  { name: 'water', label: 'השקיה' },
  { name: 'floweringSeason', label: 'עונת פריחה' },
  { name: 'flowerColor', label: 'צבע פריחה' },
  { name: 'height', label: 'גובה' },
  { name: 'spacing', label: 'מרווח שתילה' },
  { name: 'growthRate', label: 'קצב גדילה' },
  { name: 'description', label: 'תיאור', type: 'textarea' },
  { name: 'care', label: 'טיפול', type: 'textarea' },
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
}: {
  plant: Record<string, string | null> & { id: string };
}) {
  const [state, formAction] = useFormState(updatePlant, initial);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={plant.id} />

      <div className="sm:col-span-2">
        <ImageUpload
          name="imageUrl"
          defaultValue={plant.imageUrl}
          label="תמונת הצמח"
          folder="plants"
        />
      </div>

      {FIELDS.map((f) => (
        <label key={f.name} className={`text-sm ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
          <span className="mb-1 block font-medium text-gray-700">{f.label}</span>
          {f.type === 'textarea' ? (
            <textarea name={f.name} rows={3} defaultValue={plant[f.name] ?? ''} className={field} />
          ) : (
            <input name={f.name} defaultValue={plant[f.name] ?? ''} className={field} />
          )}
        </label>
      ))}

      <div className="flex items-center gap-3 sm:col-span-2">
        <SaveButton />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
