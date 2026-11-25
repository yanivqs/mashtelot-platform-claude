'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { PlantFields, type PlantSuggestions } from '@/components/admin/plant-fields';
import { PLANT_EDIT_FIELDS, type PlantFieldValues } from '@/lib/plant-fields';
import { savePlantDetailsAction, type PlantDetailsState } from './actions';
import type { RowProduct } from './product-row';

const initial: PlantDetailsState = {};

function Save() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
      {pending ? 'שומר...' : 'שמירת פרטי הצמח'}
    </button>
  );
}

/**
 * פרטי הצמח בעורך המוצר. צמח פרטי של המשתלה — נשמר בצמח עצמו;
 * צמח מהקטלוג — שינוי נשמר מקומית לחנות הזו בלבד, ועדכוני קטלוג לשדה לא יוצעו עוד.
 */
export function PlantDetailsForm({ product, suggestions }: { product: RowProduct; suggestions: PlantSuggestions }) {
  const [state, action] = useActionState(savePlantDetailsAction, initial);
  const plant = product.plant as unknown as Record<string, unknown>;
  const values: PlantFieldValues = Object.fromEntries(PLANT_EDIT_FIELDS.map((f) => [f.field, (plant[f.field] as string | null) ?? null]));

  return (
    // key: אחרי שמירה/החזרה — הטופס נטען מחדש עם הערכים מהשרת
    <form
      key={JSON.stringify(values) + product.localPlantFields.join()}
      action={action}
      className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2"
    >
      <input type="hidden" name="id" value={product.id} />
      <div className="sm:col-span-2">
        <h2 className="font-bold text-gray-900">פרטי הצמח</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {product.plantOwned
            ? 'צמח שיצרתם — מוצג בחנות שלכם בלבד. הפרטים מוצגים בדף המוצר ומשמשים את מסנני החנות (תאורה, השקיה, עונת פריחה...).'
            : 'מהקטלוג המרכזי. שינוי כאן נשמר לחנות שלכם בלבד, ועדכונים מהקטלוג לשדה ששיניתם לא יוצעו עוד (אפשר להחזיר לנתוני הקטלוג).'}
        </p>
      </div>

      <PlantFields idPrefix={`plant-${product.id}`} values={values} suggestions={suggestions} localFields={product.localPlantFields} />

      {product.plantOwned && (
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="hidden" name="submitPresent" value="1" />
          <input name="submitToCatalog" type="checkbox" defaultChecked={product.plantSubmitted} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
          <span>
            <span className="font-medium text-gray-700">הצע את הצמח לקטלוג הראשי של הפלטפורמה</span>
            <span className="block text-xs text-gray-500">אם יאושר, משתלות אחרות יוכלו להוסיף אותו לחנות שלהן.</span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2" aria-live="polite">
        <Save />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && (
          <span role="alert" className="text-sm text-red-600">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
