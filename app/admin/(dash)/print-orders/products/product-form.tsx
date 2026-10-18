'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';
import { formatPrice } from '@/lib/utils';
import { parsePriceTiers, unitPriceFor } from '@/lib/print-pricing';
import { savePrintProduct, type PrintProductState } from '../actions';

export interface PrintProductFormValues {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  specs: string | null;
  imageUrl: string | null;
  basePrice: string;
  unitLabel: string | null;
  minQuantity: number;
  leadTimeDays: number | null;
  priceTiers: Array<{ minQty: number; unitPrice: number }>;
  requiresArtwork: boolean;
  allowOptions: boolean;
  isActive: boolean;
  sortOrder: number;
}

const initial: PrintProductState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'שומר...' : 'שמירת מוצר'}
    </button>
  );
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1 block font-medium text-gray-700">
      {children}
      {hint && <span className="mr-1 text-xs font-normal text-gray-400">{hint}</span>}
    </span>
  );
}

export function PrintProductForm({
  product,
  categories,
}: {
  product: PrintProductFormValues;
  categories: string[];
}) {
  const [state, action] = useActionState(savePrintProduct, initial);
  const [basePrice, setBasePrice] = useState(product.basePrice);
  const [minQty, setMinQty] = useState(String(product.minQuantity));
  const [tiers, setTiers] = useState<Array<{ minQty: string; unitPrice: string }>>(
    product.priceTiers.map((t) => ({ minQty: String(t.minQty), unitPrice: String(t.unitPrice) })),
  );

  const parsedTiers = useMemo(() => parsePriceTiers(tiers), [tiers]);
  const base = Number(basePrice) || 0;
  const min = parseInt(minQty, 10) || 1;
  // דוגמאות תמחור לתצוגה מקדימה
  const previewQtys = useMemo(
    () => [...new Set([min, ...parsedTiers.map((t) => t.minQty)])].sort((a, b) => a - b),
    [min, parsedTiers],
  );

  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="priceTiers" value={JSON.stringify(parsedTiers)} />

      <label className="text-sm sm:col-span-2">
        <Label>שם המוצר *</Label>
        <input name="title" required defaultValue={product.title} className={field} />
      </label>

      <label className="text-sm">
        <Label hint="(לקיבוץ בתצוגה למשתלה)">קטגוריה</Label>
        <input
          name="category"
          list="print-categories"
          defaultValue={product.category ?? ''}
          placeholder="שילוט / תוויות / מיתוג..."
          className={field}
        />
        <datalist id="print-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <label className="text-sm">
        <Label hint="(קטן קודם)">סדר תצוגה</Label>
        <input name="sortOrder" type="number" defaultValue={product.sortOrder} className={field} />
      </label>

      <label className="text-sm sm:col-span-2">
        <Label>תיאור</Label>
        <textarea name="description" rows={3} defaultValue={product.description ?? ''} className={field} />
      </label>

      <label className="text-sm sm:col-span-2">
        <Label hint="(שורה לכל מפרט: מידות, חומר, עובי, הדפסה)">מפרט טכני</Label>
        <textarea
          name="specs"
          rows={3}
          defaultValue={product.specs ?? ''}
          placeholder={'מידות: 8x5 ס"מ\nחומר: PVC קשיח 0.5 מ"מ\nהדפסה: צבעונית חד-צדדית'}
          className={field}
        />
      </label>

      <div className="sm:col-span-2">
        <ImageUpload name="imageUrl" defaultValue={product.imageUrl} label="תמונת מוצר" folder="misc" />
      </div>

      <fieldset className="grid gap-4 rounded-xl border border-gray-100 p-4 sm:col-span-2 sm:grid-cols-4">
        <legend className="px-1 text-sm font-bold text-gray-900">תמחור והזמנה</legend>
        <label className="text-sm">
          <Label>מחיר בסיס ליח׳ *</Label>
          <input
            name="basePrice"
            type="number"
            step="0.01"
            min="0"
            required
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className={field}
          />
        </label>
        <label className="text-sm">
          <Label>יחידת מכירה</Label>
          <input name="unitLabel" defaultValue={product.unitLabel ?? ''} placeholder="יח׳ / גליל / חבילה" className={field} />
        </label>
        <label className="text-sm">
          <Label>כמות מינימלית</Label>
          <input
            name="minQuantity"
            type="number"
            min="1"
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            className={field}
          />
        </label>
        <label className="text-sm">
          <Label>זמן אספקה (ימים)</Label>
          <input name="leadTimeDays" type="number" min="0" defaultValue={product.leadTimeDays ?? ''} className={field} />
        </label>

        <div className="sm:col-span-4">
          <p className="mb-2 text-sm font-medium text-gray-700">
            מדרגות מחיר לפי כמות{' '}
            <span className="text-xs font-normal text-gray-400">(מחיר ליח׳ מכמות מסוימת ומעלה)</span>
          </p>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">מ-</span>
                <input
                  type="number"
                  min="1"
                  value={t.minQty}
                  onChange={(e) =>
                    setTiers((all) => all.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)))
                  }
                  className={`${field} w-28`}
                  placeholder="כמות"
                />
                <span className="text-gray-500">יח׳ —</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={t.unitPrice}
                  onChange={(e) =>
                    setTiers((all) => all.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))
                  }
                  className={`${field} w-28`}
                  placeholder="₪ ליח׳"
                />
                <button
                  type="button"
                  onClick={() => setTiers((all) => all.filter((_, j) => j !== i))}
                  className="p-1 text-gray-400 hover:text-red-600"
                  aria-label="הסרת מדרגה"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTiers((all) => [...all, { minQty: '', unitPrice: '' }])}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
            >
              <Plus className="h-4 w-4" /> הוספת מדרגה
            </button>
          </div>

          {base > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {previewQtys.map((q) => (
                <span key={q} className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">
                  {q.toLocaleString('he-IL')} יח׳ → {formatPrice(unitPriceFor(base, parsedTiers, q))} ליח׳ ·
                  סה״כ {formatPrice(unitPriceFor(base, parsedTiers, q) * q)}
                </span>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      <div className="space-y-2 text-sm sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="requiresArtwork" defaultChecked={product.requiresArtwork} className="h-4 w-4" />
          דורש קובץ גרפי מהמשתלה (לוגו / עיצוב)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allowOptions" defaultChecked={product.allowOptions} className="h-4 w-4" />
          ניתן להוסיף אפשרויות גימור (למינציה, UV וכו')
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={product.isActive} className="h-4 w-4" />
          פעיל — מוצג למשתלות להזמנה
        </label>
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <SaveButton />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
