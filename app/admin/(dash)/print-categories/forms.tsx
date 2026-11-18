'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { deleteCategoryAction, saveCategoryAction, type CategoryFormState } from './actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const initial: CategoryFormState = {};

export interface CategoryValues {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? 'שומר...' : label}
    </button>
  );
}

function Feedback({ state }: { state: CategoryFormState }) {
  return (
    <span aria-live="polite">
      {state.message && <span className="text-sm text-green-700">{state.message}</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </span>
  );
}

/** טופס קטגוריה: חדשה (בלי value) או עריכה. האב — רק קטגוריה ראשית. */
export function CategoryForm({ value, parents }: { value?: CategoryValues; parents: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(saveCategoryAction, initial);
  const p = value?.id ?? 'new';
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" key={value ? undefined : state.message}>
      {value && <input type="hidden" name="id" value={value.id} />}
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם</span>
        <input name="name" defaultValue={value?.name ?? ''} required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">כתובת (באנגלית)</span>
        <input name="slug" dir="ltr" defaultValue={value?.slug ?? ''} required placeholder="greeting-cards" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">תחת קטגוריה</span>
        <select name="parentId" defaultValue={value?.parentId ?? ''} className={field}>
          <option value="">— קטגוריה ראשית —</option>
          {parents
            .filter((x) => x.id !== value?.id)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">סדר</span>
        <input name="sortOrder" type="number" min="0" defaultValue={value?.sortOrder ?? 0} className={field} />
      </label>
      <div className="sm:col-span-2">
        <ImageUpload name="imageUrl" defaultValue={value?.imageUrl ?? null} label="תמונה (לא חובה)" folder="misc" hint="מומלץ 1200×900" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2" htmlFor={`active-${p}`}>
        <input id={`active-${p}`} name="isActive" type="checkbox" defaultChecked={value?.isActive ?? true} className="h-4 w-4" />
        מוצגת למשתלות
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit label={value ? 'שמירה' : 'הוספת קטגוריה'} />
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function DeleteCategoryForm({ id }: { id: string }) {
  const [state, action] = useActionState(deleteCategoryAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button className="text-sm text-red-700 hover:underline">מחיקת הקטגוריה</button>
      <Feedback state={state} />
    </form>
  );
}
