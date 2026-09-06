'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { ChevronDown, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { updateProduct, deleteProduct, type ProductFormState } from './actions';

export interface RowProduct {
  id: string;
  title: string;
  latinName: string | null;
  image: string | null;
  kind: 'צמח' | 'ציוד';
  price: string;
  compareAtPrice: string | null;
  stockQuantity: number;
  isActive: boolean;
  customTitle: string | null;
  customDescription: string | null;
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
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

export function ProductRow({ product }: { product: RowProduct }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(updateProduct, initial);

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
        <div className="hidden w-24 text-sm text-gray-700 sm:block">{formatPrice(product.price)}</div>
        <div className="hidden w-20 text-sm text-gray-700 sm:block">
          {product.stockQuantity} יח׳
        </div>
        <span
          className={`hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${
            product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {product.isActive ? 'פעיל' : 'מוסתר'}
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
          <form action={formAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={product.id} />

            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">מחיר (₪)</span>
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
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">מלאי</span>
              <input
                name="stockQuantity"
                type="number"
                min="0"
                defaultValue={product.stockQuantity}
                className={field}
              />
            </label>
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={product.isActive}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-medium text-gray-700">מוצג בחנות</span>
            </label>

            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">
                כותרת מותאמת (דורסת את שם הצמח בחנות)
              </span>
              <input name="customTitle" defaultValue={product.customTitle ?? ''} className={field} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">תיאור מותאם</span>
              <textarea
                name="customDescription"
                rows={2}
                defaultValue={product.customDescription ?? ''}
                className={field}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">כותרת SEO (meta title)</span>
              <input name="seoMetaTitle" defaultValue={product.seoMetaTitle ?? ''} className={field} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">תיאור SEO (meta description)</span>
              <textarea
                name="seoMetaDescription"
                rows={2}
                defaultValue={product.seoMetaDescription ?? ''}
                className={field}
              />
            </label>

            <div className="flex items-center gap-3 sm:col-span-2">
              <SaveButton />
              {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
              {state.error && <span className="text-sm text-red-600">{state.error}</span>}
            </div>
          </form>

          <form
            action={deleteProduct}
            className="mt-3 border-t border-gray-200 pt-3"
          >
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
