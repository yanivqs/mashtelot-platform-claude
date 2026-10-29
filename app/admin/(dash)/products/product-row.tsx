'use client';

import { useActionState, useState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import { ChevronDown, Trash2, AlertCircle } from 'lucide-react';
import type { Plant } from '@prisma/client';
import { ImageUpload } from '@/components/admin/image-upload';
import { SpecTable } from '@/components/storefront/spec-table';
import { formatPrice } from '@/lib/utils';
import { SEO_LEVEL_META, type SeoScore } from '@/lib/seo-score';
import { updateProduct, deleteProduct, type ProductFormState } from './actions';
import { VariantsEditor, type EditorVariant } from './variants-editor';

export interface RowProduct {
  id: string;
  title: string;
  latinName: string | null;
  image: string | null;
  kind: 'צמח' | 'ציוד' | 'מוצר מותאם';
  price: string;
  compareAtPrice: string | null;
  stockQuantity: number;
  /** יחידות שמורות להזמנות פתוחות */
  reservedQuantity: number;
  isActive: boolean;
  customTitle: string | null;
  customDescription: string | null;
  customImageUrl: string | null;
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
  categoryIds: string[];
  plant: Plant | null;
  seo: SeoScore;
  /** שם האפשרות לבחירת וריאנט (למשל "גודל עציץ") */
  optionLabel: string | null;
  /** שם הציר השני (למשל "צבע") */
  option2Label: string | null;
  /** כל הווריאנטים (כולל מושבתים), ברירת המחדל ראשונה */
  variants: EditorVariant[];
}

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

const initial: ProductFormState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירה'}
    </button>
  );
}

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

export function ProductRow({
  product,
  categoryOptions,
}: {
  product: RowProduct;
  categoryOptions: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateProduct, initial);
  const keep = useKeepFormValues(state);
  const [imageUrl, setImageUrl] = useState(product.customImageUrl ?? '');
  const multi = product.variants.length > 1;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-lg">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>🪴</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">
            {product.customTitle || product.title}
          </p>
          <p className="text-xs text-gray-400">
            {product.kind}
            {product.latinName ? ` · ${product.latinName}` : ''}
          </p>
        </div>
        <div className="hidden w-24 text-sm text-gray-700 sm:block">
          {formatPrice(product.price)}
          {multi && <span className="block text-xs text-gray-400">{product.variants.length} וריאנטים</span>}
        </div>
        <div className="hidden w-20 text-sm text-gray-700 sm:block">
          {product.stockQuantity} יח׳
          {product.reservedQuantity > 0 && (
            <span className="text-sky-700"> · {product.reservedQuantity} שמורות</span>
          )}
        </div>
        <span
          className={`hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${
            product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {product.isActive ? 'פעיל' : 'מוסתר'}
        </span>
        <span
          className="hidden items-center gap-1 text-xs sm:flex"
          title={`מדד SEO: ${product.seo.score}/100 (${SEO_LEVEL_META[product.seo.level].label})`}
        >
          <span className={`h-2 w-2 rounded-full ${SEO_LEVEL_META[product.seo.level].dot}`} />
          <span className={SEO_LEVEL_META[product.seo.level].text}>SEO</span>
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="עריכה"
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="bg-gray-50 px-4 py-4">
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
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
                        issue.severity === 'high'
                          ? 'text-rose-500'
                          : issue.severity === 'medium'
                            ? 'text-amber-500'
                            : 'text-gray-400'
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

          <form ref={keep} action={formAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={product.id} />

            <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <ImageUpload
                name="customImageUrl"
                defaultValue={product.customImageUrl}
                label="תמונת המוצר בחנות"
                folder="plants"
                onChange={setImageUrl}
              />
              {!imageUrl && (
                <p className="mt-2 text-xs text-amber-800">
                  שימו לב: ללא תמונה ייחודית תוצג התמונה הכללית של הצמח, המשותפת למשתלות אחרות.
                  הדבר עלול להוביל לדירוג נמוך בתוצאות החיפוש — מומלץ להעלות תמונה משלכם.
                </p>
              )}
            </div>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">{multi ? 'מחיר בסיס (₪) — לווריאנטים בלי מחיר משלהם' : 'מחיר (₪)'}</span>
              <input name="price" type="number" step="0.01" min="0" defaultValue={product.price} className={field} required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">מחיר לפני הנחה (₪)</span>
              <input
                name="compareAtPrice"
                type="number"
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
                <input name="stockQuantity" type="number" min="0" defaultValue={product.stockQuantity} className={field} />
              </label>
            )}
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={product.isActive}
                className="h-4 w-4 rounded border-gray-300"
              />
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

            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">
                כותרת מותאמת (דורסת את שם הצמח בחנות)
              </span>
              <input name="customTitle" defaultValue={product.customTitle ?? ''} className={field} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">
                תיאור מותאם
                <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                  חשוב ל-SEO
                </span>
              </span>
              <textarea name="customDescription" rows={3} defaultValue={product.customDescription ?? ''} className={field} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">כותרת SEO (meta title)</span>
              <input name="seoMetaTitle" defaultValue={product.seoMetaTitle ?? ''} className={field} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">תיאור SEO (meta description)</span>
              <textarea name="seoMetaDescription" rows={2} defaultValue={product.seoMetaDescription ?? ''} className={field} />
            </label>

            <div className="flex items-center gap-3 sm:col-span-2">
              <SaveButton />
              {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
              {state.error && <span className="text-sm text-red-600">{state.error}</span>}
            </div>
          </form>

          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
            <VariantsEditor
              productId={product.id}
              basePrice={product.price}
              variants={product.variants}
              axis1Label={product.optionLabel?.trim() || 'גודל'}
              axis2Label={product.option2Label?.trim() || 'צבע'}
            />
          </div>

          {product.plant && (
            <details className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-900">
                מידע בוטני מלא (קריאה בלבד — הגרסה שאישרתם מהקטלוג המרכזי)
              </summary>
              <div className="mt-3">
                <SpecTable plant={product.plant} />
              </div>
            </details>
          )}

          <form action={deleteProduct} className="mt-3 border-t border-gray-200 pt-3">
            <input type="hidden" name="id" value={product.id} />
            <button className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800">
              <Trash2 className="h-4 w-4" />
              הסרת המוצר מהחנות
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
