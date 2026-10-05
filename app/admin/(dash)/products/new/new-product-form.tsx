'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { createCustomProduct, type ProductFormState } from '../actions';

const initial: ProductFormState = {};
const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'יצירת מוצר'}
    </button>
  );
}

export function NewProductForm({
  categoryOptions,
}: {
  categoryOptions: Array<{ id: string; name: string; depth: number }>;
}) {
  const [state, formAction] = useFormState(createCustomProduct, initial);
  const [imageUrl, setImageUrl] = useState('');

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">שם המוצר *</span>
        <input name="customTitle" required className={field} />
      </label>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
        <ImageUpload
          name="customImageUrl"
          label="תמונת המוצר"
          folder="plants"
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
      <label className="flex items-center gap-2 self-end text-sm">
        <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300" />
        <span className="font-medium text-gray-700">מוצג בחנות</span>
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
