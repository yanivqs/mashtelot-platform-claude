'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { SUPPLY_CATEGORIES, SUPPLY_CATEGORY_LABELS } from '@/lib/manufacturers';
import {
  deleteManufacturerAction,
  deleteSupplyAction,
  saveManufacturerAction,
  saveSupplyAction,
  type AdminFormState,
} from './actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const initial: AdminFormState = {};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
      {pending ? 'שומר...' : label}
    </button>
  );
}

function Feedback({ state }: { state: AdminFormState }) {
  return (
    <span aria-live="polite">
      {state.message && <span className="text-sm text-green-700">{state.message}</span>}
      {state.error && (
        <span role="alert" className="text-sm text-red-600">
          {state.error}
        </span>
      )}
    </span>
  );
}

export interface ManufacturerValues {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  isActive: boolean;
}

export function ManufacturerForm({ value }: { value?: ManufacturerValues }) {
  const [state, action] = useActionState(saveManufacturerAction, initial);
  const ref = useKeepFormValues(state);
  const p = value?.id ?? 'new';
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      {value && <input type="hidden" name="id" value={value.id} />}
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם הספק / היצרן</span>
        <input name="name" defaultValue={value?.name ?? ''} required maxLength={80} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">אתר (לא חובה)</span>
        <input name="website" dir="ltr" defaultValue={value?.website ?? ''} placeholder="https://" className={field} />
      </label>
      <div className="sm:col-span-2">
        <ImageUpload name="logoUrl" defaultValue={value?.logoUrl ?? null} label="לוגו" folder="logos" hint="רקע שקוף או לבן, לפחות 300 פיקסלים" />
      </div>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">תיאור (לא חובה)</span>
        <textarea name="description" rows={3} defaultValue={value?.description ?? ''} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2" htmlFor={`m-active-${p}`}>
        <input id={`m-active-${p}`} name="isActive" type="checkbox" defaultChecked={value?.isActive ?? true} className="h-4 w-4" />
        פעיל — מוצג למשתלות ובחנויות
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit label={value ? 'שמירה' : 'הוספת ספק / יצרן'} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function DeleteManufacturerForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteManufacturerAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button className="text-sm text-red-700 hover:underline">מחיקת הספק / היצרן</button>
      <Feedback state={state} />
    </form>
  );
}

export interface SupplyValues {
  id: string;
  title: string;
  manufacturerId: string | null;
  manufacturerCode: string | null;
  barcode: string | null;
  category: string;
  description: string | null;
  imageUrl: string | null;
  suggestedPrice: string | null;
}

export function SupplyForm({
  value,
  manufacturers,
  defaultManufacturerId,
}: {
  value?: SupplyValues;
  manufacturers: Array<{ id: string; name: string; isActive: boolean }>;
  defaultManufacturerId?: string | null;
}) {
  const [state, action] = useActionState(saveSupplyAction, initial);
  const ref = useKeepFormValues(state);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2">
      {value && <input type="hidden" name="id" value={value.id} />}
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">שם המוצר</span>
        <input name="title" defaultValue={value?.title ?? ''} required maxLength={160} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">ספק / יצרן</span>
        <select name="manufacturerId" defaultValue={value?.manufacturerId ?? defaultManufacturerId ?? ''} className={field}>
          <option value="">— ללא —</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.isActive ? '' : ' (מושבת)'}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קטגוריה</span>
        <select name="category" defaultValue={value?.category ?? 'GENERAL'} className={field}>
          {SUPPLY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUPPLY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קוד יצרן</span>
        <input name="manufacturerCode" dir="ltr" defaultValue={value?.manufacturerCode ?? ''} maxLength={60} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">ברקוד</span>
        <input name="barcode" dir="ltr" inputMode="numeric" defaultValue={value?.barcode ?? ''} maxLength={40} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מחיר מומלץ לצרכן (₪, לא חובה)</span>
        <input name="suggestedPrice" type="number" min="0" step="0.01" defaultValue={value?.suggestedPrice ?? ''} className={field} />
        <span className="mt-1 block text-xs text-gray-500">משמש כמחיר ההתחלתי כשמשתלה מושכת את המוצר</span>
      </label>
      <div className="sm:col-span-2">
        <ImageUpload name="imageUrl" defaultValue={value?.imageUrl ?? null} label="תמונה" folder="misc" hint="רקע לבן, לפחות 800 פיקסלים" />
      </div>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">תיאור</span>
        <textarea name="description" rows={5} defaultValue={value?.description ?? ''} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit label={value ? 'שמירה' : 'הוספת מוצר'} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function DeleteSupplyForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteSupplyAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button className="text-sm text-red-700 hover:underline">מחיקת המוצר מהקטלוג</button>
      <Feedback state={state} />
    </form>
  );
}
