'use client';

import { useActionState, useState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { createCustomProduct, type ProductFormState } from '../actions';
import { ManufacturerFields, type ManufacturerOption } from '@/components/admin/manufacturer-fields';
import { PlantFields, type PlantSuggestions } from '@/components/admin/plant-fields';

const initial: ProductFormState = {};
const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'יצירת מוצר'}
    </button>
  );
}

export function NewProductForm({
  categoryOptions,
  manufacturers,
  plantSuggestions,
  allowPlant,
}: {
  categoryOptions: Array<{ id: string; name: string; depth: number }>;
  manufacturers: ManufacturerOption[];
  plantSuggestions: PlantSuggestions;
  /** למשתלה עם מודול קטלוג הצמחים */
  allowPlant: boolean;
}) {
  const [state, formAction] = useActionState(createCustomProduct, initial);
  const keep = useKeepFormValues(state);
  const [imageUrl, setImageUrl] = useState('');
  const [kind, setKind] = useState<'plant' | 'other'>(allowPlant ? 'plant' : 'other');

  return (
    <form ref={keep} action={formAction} className="grid gap-4 sm:grid-cols-2">
      {allowPlant && (
        <fieldset className="text-sm sm:col-span-2">
          <legend className="mb-2 font-medium text-gray-700">סוג המוצר</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['plant', 'צמח', 'עם שמש, השקיה, פריחה ושאר הפרטים הבוטניים'],
                ['other', 'מוצר אחר', 'ציוד, שירות או פריט מיוחד'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`flex min-w-[12rem] flex-1 cursor-pointer items-start gap-2 rounded-lg border p-3 ${kind === value ? 'border-brand-700 bg-brand-50' : 'border-gray-200'}`}
              >
                <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="block font-medium text-gray-900">{label}</span>
                  <span className="block text-xs text-gray-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {kind === 'plant' ? (
        <fieldset className="grid gap-4 rounded-lg border border-gray-200 p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-sm font-bold text-gray-900">פרטי הצמח</legend>
          <PlantFields idPrefix="new-plant" suggestions={plantSuggestions} />
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input name="submitToCatalog" type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>
              <span className="font-medium text-gray-700">הצע את הצמח לקטלוג הראשי של הפלטפורמה</span>
              <span className="block text-xs text-gray-500">
                הצמח מוצג מיד רק בחנות שלכם. אם יאושר, הוא יתווסף לקטלוג ומשתלות אחרות יוכלו להוסיף אותו לחנות שלהן.
              </span>
            </span>
          </label>
        </fieldset>
      ) : (
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">שם המוצר *</span>
          <input name="customTitle" required className={field} />
        </label>
      )}

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
        <ImageUpload
          name="customImageUrl"
          label="תמונת המוצר"
          folder="plants"
          nurseryFolder
          onChange={setImageUrl}
        />
        {!imageUrl && (
          <p className="mt-2 text-xs text-amber-800">
            ללא תמונה המוצר יופיע בחנות בלי תמונה. מוצר ללא תמונה עלול להוביל לדירוג נמוך בתוצאות
            החיפוש.
          </p>
        )}
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מחיר (₪) *</span>
        <input name="price" type="number" step="0.01" min="0" required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מחיר לפני הנחה (₪)</span>
        <input name="compareAtPrice" type="number" step="0.01" min="0" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מלאי</span>
        <input name="stockQuantity" type="number" min="0" defaultValue={0} className={field} />
      </label>
      <ManufacturerFields manufacturers={manufacturers} withCodes />
      <label className="flex items-center gap-2 self-end text-sm">
        <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
        <span className="font-medium text-gray-700">מוצג בחנות</span>
      </label>
      <label className="flex items-start gap-2 self-end text-sm">
        <input name="alwaysInStock" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
        <span>
          <span className="font-medium text-gray-700">תמיד במלאי</span>
          <span className="block text-xs text-gray-500">זמין להזמנה בלי קשר לכמות — המלאי לא נבדק ולא יורד</span>
        </span>
      </label>

      {categoryOptions.length > 0 && (
        <fieldset className="text-sm sm:col-span-2">
          <legend className="mb-1 font-medium text-gray-700">קטגוריות בחנות שלי</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {categoryOptions.map((c) => (
              <label key={c.id} className="flex items-center gap-2" style={{ paddingInlineStart: `${c.depth}rem` }}>
                <input type="checkbox" name="categoryIds" value={c.id} className="h-4 w-4 rounded border-gray-300" />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">תיאור המוצר (חשוב ל-SEO)</span>
        <textarea name="customDescription" rows={4} className={field} />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">כותרת SEO (meta title)</span>
        <input name="seoMetaTitle" className={field} />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">תיאור SEO (meta description)</span>
        <textarea name="seoMetaDescription" rows={2} className={field} />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
