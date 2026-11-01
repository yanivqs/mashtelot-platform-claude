'use client';

import { useActionState, useState, useTransition } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import { Trash2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';
import { SpecTable } from '@/components/storefront/spec-table';
import { SEO_LEVEL_META } from '@/lib/seo-score';
import { normalizeProductSlug } from '@/lib/utils';
import { updateProduct, deleteProduct, suggestProductSlug, type ProductFormState } from './actions';
import { VariantsEditor } from './variants-editor';
import type { CategoryOption, RowProduct } from './product-row';

const initial: ProductFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="w-full rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירה'}
    </button>
  );
}

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-base outline-none focus:border-brand-500 sm:text-sm';

/** שדה כתובת המוצר + הצעה באנגלית עם AI. */
function SlugField({ product, aiAvailable, storeOrigin }: { product: RowProduct; aiAvailable: boolean; storeOrigin: string }) {
  const [value, setValue] = useState(product.slug ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const preview = normalizeProductSlug(value) ?? product.autoSlug;

  function suggest() {
    setError(null);
    const title = (document.querySelector<HTMLInputElement>('input[name="customTitle"]')?.value || '').trim() || product.title;
    startTransition(async () => {
      const res = await suggestProductSlug(product.id, title);
      if (res.slug) setValue(res.slug);
      else setError(res.error ?? 'לא התקבלה הצעה');
    });
  }

  return (
    <div className="text-sm sm:col-span-2">
      <label htmlFor={`slug-${product.id}`} className="mb-1 block font-medium text-gray-700">
        כתובת המוצר באתר (באנגלית)
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`slug-${product.id}`}
          name="slug"
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="watering-can-10l"
          className={`${field} font-mono`}
        />
        <button
          type="button"
          onClick={suggest}
          disabled={!aiAvailable || pending}
          title={aiAvailable ? undefined : 'הצעת AI עדיין לא הוגדרה בפלטפורמה'}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          הצע שם עם AI
        </button>
      </div>
      <p className="mt-1 break-all text-xs text-gray-500" dir="ltr">
        {storeOrigin}/product/{preview}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        קצר ותיאורי באנגלית. ריק — נבנה אוטומטית משם המוצר. כתובות קודמות ממשיכות לעבוד ומופנות לכתובת החדשה.
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ProductEditor({
  product,
  categoryOptions,
  aiAvailable,
  storeOrigin,
}: {
  product: RowProduct;
  categoryOptions: CategoryOption[];
  aiAvailable: boolean;
  storeOrigin: string;
}) {
  const [state, formAction] = useActionState(updateProduct, initial);
  const keep = useKeepFormValues(state);
  const [imageUrl, setImageUrl] = useState(product.customImageUrl ?? '');
  const multi = product.variants.length > 1;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <span className={`h-2.5 w-2.5 rounded-full ${SEO_LEVEL_META[product.seo.level].dot}`} />
          מדד SEO: {product.seo.score}/100 · {SEO_LEVEL_META[product.seo.level].label}
        </div>
        {product.seo.issues.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {product.seo.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <AlertCircle
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    issue.severity === 'high' ? 'text-rose-500' : issue.severity === 'medium' ? 'text-amber-500' : 'text-gray-400'
                  }`}
                />
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-green-700">כל שדות ה-SEO מולאו. מצוין.</p>
        )}
      </div>

      <form ref={keep} action={formAction} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={product.id} />

        <div
          className={`rounded-lg border p-3 sm:col-span-2 ${
            product.imageRequired && !imageUrl ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <ImageUpload
            name="customImageUrl"
            defaultValue={product.customImageUrl}
            label="תמונת המוצר בחנות"
            folder="plants"
            onChange={setImageUrl}
          />
          {product.imageRequired && !imageUrl ? (
            <p className="mt-2 text-xs font-medium text-red-800">
              חובה להעלות תמונה משלכם — עד אז המוצר מוסתר מהאתר. לאחר ההעלאה לחצו "שמירה".
            </p>
          ) : (
            !imageUrl && (
              <p className="mt-2 text-xs text-amber-800">
                שימו לב: ללא תמונה ייחודית תוצג התמונה הכללית של הצמח, המשותפת למשתלות אחרות. הדבר עלול להוביל לדירוג
                נמוך בתוצאות החיפוש — מומלץ להעלות תמונה משלכם.
              </p>
            )
          )}
        </div>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">שם המוצר בחנות (דורס את שם הצמח)</span>
          <input name="customTitle" defaultValue={product.customTitle ?? ''} placeholder={product.title} className={field} />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">
            תיאור המוצר
            <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">חשוב ל-SEO</span>
          </span>
          {product.needsDescription && (
            <span className="mb-1.5 block rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
              חסר תיאור משלכם — כרגע מוצג התיאור הכללי מהקטלוג, המשותף למשתלות אחרות. כתבו תיאור ייחודי.
            </span>
          )}
          <textarea name="customDescription" rows={4} defaultValue={product.customDescription ?? ''} className={field} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">{multi ? 'מחיר בסיס (₪) — לווריאנטים בלי מחיר משלהם' : 'מחיר (₪)'}</span>
          <input name="price" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={product.price} className={field} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מחיר לפני הנחה (₪)</span>
          <input
            name="compareAtPrice"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            defaultValue={product.compareAtPrice ?? ''}
            className={field}
          />
        </label>
        {multi ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">שמות האפשרויות בחנות</span>
            <span className="flex gap-2">
              <input name="optionLabel" aria-label="שם הציר הראשון" defaultValue={product.optionLabel ?? ''} placeholder="ציר 1: גודל" className={field} />
              <input name="option2Label" aria-label="שם הציר השני" defaultValue={product.option2Label ?? ''} placeholder="ציר 2: צבע" className={field} />
            </span>
            <span className="mt-1 block text-xs text-gray-500">המלאי מנוהל לכל וריאנט בנפרד (למטה).</span>
          </label>
        ) : (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">מלאי</span>
            <input name="stockQuantity" type="number" inputMode="numeric" min="0" defaultValue={product.stockQuantity} className={field} />
          </label>
        )}
        <label className="flex items-center gap-2 self-end text-sm">
          <input name="isActive" type="checkbox" defaultChecked={product.isActive} className="h-5 w-5 rounded border-gray-300" />
          <span className="font-medium text-gray-700">מוצג בחנות</span>
        </label>

        {categoryOptions.length > 0 && (
          <fieldset className="text-sm sm:col-span-2">
            <legend className="mb-1 font-medium text-gray-700">קטגוריות בחנות שלי</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {categoryOptions.map((c) => (
                <label key={c.id} className="flex items-center gap-2" style={{ paddingInlineStart: `${c.depth * 1}rem` }}>
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={c.id}
                    defaultChecked={product.categoryIds.includes(c.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <SlugField product={product} aiAvailable={aiAvailable} storeOrigin={storeOrigin} />

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">כותרת SEO (meta title)</span>
          <input name="seoMetaTitle" defaultValue={product.seoMetaTitle ?? ''} className={field} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-medium text-gray-700">תיאור SEO (meta description)</span>
          <textarea name="seoMetaDescription" rows={2} defaultValue={product.seoMetaDescription ?? ''} className={field} />
        </label>

        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-b-xl border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:col-span-2">
          <SaveButton />
          {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
          {state.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <VariantsEditor
          productId={product.id}
          basePrice={product.price}
          variants={product.variants}
          axis1Label={product.optionLabel?.trim() || 'גודל'}
          axis2Label={product.option2Label?.trim() || 'צבע'}
        />
      </div>

      {product.plant && (
        <details className="rounded-xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-900">
            מידע בוטני מלא (קריאה בלבד — הגרסה שאישרתם מהקטלוג המרכזי)
          </summary>
          <div className="mt-3">
            <SpecTable plant={product.plant} />
          </div>
        </details>
      )}

      <form action={deleteProduct} className="pt-1">
        <input type="hidden" name="id" value={product.id} />
        <button className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800">
          <Trash2 className="h-4 w-4" />
          הסרת המוצר מהחנות
        </button>
      </form>
    </div>
  );
}
