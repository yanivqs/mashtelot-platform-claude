'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { X } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';
import { formatPrice } from '@/lib/utils';
import { deleteVariantAction, saveVariantAction, type VariantFormState } from './variant-actions';

export interface EditorVariant {
  id: string;
  /** ערך הציר הראשון */
  name: string;
  option2: string | null;
  colorHex: string | null;
  sku: string | null;
  barcode: string | null;
  price: string | null;
  compareAtPrice: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  imageUrls: string[];
  isDefault: boolean;
  isActive: boolean;
}

const initial: VariantFormState = {};
const field = 'w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'שומר...' : label}
    </button>
  );
}

/** רשימת תמונות לווריאנט: הסרה + העלאת תמונה נוספת (נשלחות כ-imageUrls). */
function VariantImages({ initialUrls }: { initialUrls: string[] }) {
  const [urls, setUrls] = useState(initialUrls);
  const [uploaderKey, setUploaderKey] = useState(0);
  return (
    <div className="sm:col-span-3">
      <span className="mb-1 block text-xs font-medium text-gray-700">תמונות הווריאנט (מוצגות לפני תמונת המוצר)</span>
      <div className="flex flex-wrap items-start gap-2">
        {urls.map((u) => (
          <div key={u} className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200">
            <input type="hidden" name="imageUrls" value={u} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="הסרת תמונה"
              onClick={() => setUrls((prev) => prev.filter((x) => x !== u))}
              className="absolute left-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {urls.length < 8 && (
          <ImageUpload
            key={uploaderKey}
            folder="plants"
            onChange={(url) => {
              if (!url) return;
              setUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
              setUploaderKey((k) => k + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

interface AxisLabels {
  axis1Label: string;
  axis2Label: string;
}

/** דוגמית צבע אופציונלית לווריאנט (מוצגת כעיגול בבורר בחנות). */
function ColorSwatchField({ initial }: { initial: string | null }) {
  const [on, setOn] = useState(Boolean(initial));
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <input name="useColor" type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4" />
      דוגמית צבע
      {on && <input name="colorHex" type="color" aria-label="צבע הדוגמית" defaultValue={initial ?? '#e07b39'} className="h-7 w-10 cursor-pointer rounded border border-gray-200" />}
    </label>
  );
}

function VariantForm({
  productId,
  basePrice,
  variant,
  axis1Label,
  axis2Label,
}: {
  productId: string;
  basePrice: string;
  variant: EditorVariant | null;
} & AxisLabels) {
  const [state, action] = useActionState(saveVariantAction, initial);
  const [delState, delAction] = useActionState(deleteVariantAction, initial);
  // React 19 מאפס את הטופס אחרי שמירה; בשגיאה ערכי ברירת המחדל הם מה שהוקלד (UX-01)
  const v = (k: string, fallback: string) => (state.error && state.values ? state.values[k] ?? fallback : fallback);
  const isNew = variant === null;

  return (
    <div className={`rounded-lg border p-3 ${variant && !variant.isActive ? 'border-dashed border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <form action={action} className="grid gap-2 sm:grid-cols-3">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="variantId" value={variant?.id ?? ''} />
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-gray-700">
            {axis1Label} {variant?.isDefault && '(ברירת מחדל)'}
          </span>
          <input name="name" defaultValue={v('name', variant?.name ?? '')} placeholder="למשל: עציץ 4 ליטר" className={field} />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-gray-700">{axis2Label} (לא חובה)</span>
          <input name="option2" defaultValue={v('option2', variant?.option2 ?? '')} placeholder="למשל: כתום" className={field} />
        </label>
        <div className="flex items-end pb-1.5 text-xs">
          <ColorSwatchField initial={variant?.colorHex ?? null} />
        </div>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-gray-700">מחיר (₪)</span>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={v('price', variant?.price ?? '')}
            placeholder={`יורש: ${formatPrice(basePrice)}`}
            className={field}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-gray-700">מחיר לפני הנחה (₪)</span>
          <input name="compareAtPrice" type="number" step="0.01" min="0" defaultValue={v('compareAtPrice', variant?.compareAtPrice ?? '')} className={field} />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-gray-700">
            מלאי{variant && variant.reservedQuantity > 0 ? ` (${variant.reservedQuantity} שמורות)` : ''}
          </span>
          <input name="stockQuantity" type="number" min="0" defaultValue={v('stockQuantity', String(variant?.stockQuantity ?? 0))} className={field} />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-gray-700">SKU</span>
          <input name="sku" dir="ltr" defaultValue={v('sku', variant?.sku ?? '')} className={field} />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-gray-700">ברקוד</span>
          <input name="barcode" dir="ltr" inputMode="numeric" defaultValue={v('barcode', variant?.barcode ?? '')} className={field} />
        </label>
        <VariantImages initialUrls={variant?.imageUrls ?? []} />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <label className="flex items-center gap-1.5 text-xs">
            <input name="isActive" type="checkbox" defaultChecked={variant?.isActive ?? true} className="h-4 w-4" />
            פעיל
          </label>
          <Submit label={isNew ? 'הוספת וריאנט' : 'שמירת וריאנט'} />
          {state.message && <span className="text-xs text-green-700">{state.message}</span>}
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </div>
      </form>
      {variant && !variant.isDefault && (
        <form action={delAction} className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={variant.id} />
          <button className="text-xs text-red-600 hover:underline">הסרת וריאנט</button>
          {delState.message && <span className="text-xs text-gray-600">{delState.message}</span>}
          {delState.error && <span className="text-xs text-red-600">{delState.error}</span>}
        </form>
      )}
    </div>
  );
}

/** עריכת וריאנטים של מוצר (§7.01): מחיר ריק = יורש ממחיר המוצר. */
export function VariantsEditor({
  productId,
  basePrice,
  variants,
  axis1Label,
  axis2Label,
}: {
  productId: string;
  basePrice: string;
  variants: EditorVariant[];
} & AxisLabels) {
  const labels = { axis1Label, axis2Label };
  const [adding, setAdding] = useState(false);
  return (
    <section className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">וריאנטים (גודל / צבע / אריזה)</h3>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs font-medium text-brand-700 hover:underline">
            + הוספת וריאנט
          </button>
        )}
      </div>
      {variants.length <= 1 && !adding && (
        <p className="text-xs text-gray-500">
          למוצר יש אפשרות אחת. הוסיפו וריאנט כדי להציע ללקוחות בחירה — לפי {axis1Label} ולפי {axis2Label} (למשל קטן/גדול × כתום/בז'), עם מחיר, מלאי ותמונות לכל שילוב.
        </p>
      )}
      {variants.length > 1 && variants.map((v) => <VariantForm key={v.id} productId={productId} basePrice={basePrice} variant={v} {...labels} />)}
      {variants.length <= 1 && adding && variants[0] && (
        <>
          <p className="text-xs text-gray-500">תנו שם גם לאפשרות הקיימת:</p>
          <VariantForm productId={productId} basePrice={basePrice} variant={variants[0]} {...labels} />
        </>
      )}
      {adding && <VariantForm productId={productId} basePrice={basePrice} variant={null} {...labels} />}
    </section>
  );
}
