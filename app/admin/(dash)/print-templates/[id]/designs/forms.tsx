'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { saveDesignAction, type DesignFormState } from './actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const initial: DesignFormState = {};

export interface DesignValues {
  id: string;
  code: string;
  title: string;
  imageUrl: string;
  tags: string[];
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

export function DesignForm({ templateId, value, nextSort = 0 }: { templateId: string; value?: DesignValues; nextSort?: number }) {
  const [state, action] = useActionState(saveDesignAction, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" key={value ? undefined : state.message}>
      <input type="hidden" name="templateId" value={templateId} />
      {value && <input type="hidden" name="id" value={value.id} />}
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קוד</span>
        <input name="code" dir="ltr" required defaultValue={value?.code ?? ''} placeholder="SC9650" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם</span>
        <input name="title" required defaultValue={value?.title ?? ''} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">תגיות (מופרדות בפסיק)</span>
        <input name="tags" defaultValue={value?.tags.join(', ') ?? ''} placeholder="יום הולדת, איור" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">סדר</span>
        <input name="sortOrder" type="number" min="0" defaultValue={value?.sortOrder ?? nextSort} className={field} />
      </label>
      <div className="sm:col-span-2">
        <ImageUpload name="imageUrl" defaultValue={value?.imageUrl ?? null} label="תמונת הדוגמא" folder="misc" hint="מומלץ 1200×1200, רקע לבן" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input name="isActive" type="checkbox" defaultChecked={value?.isActive ?? true} className="h-4 w-4" />
        זמינה להזמנה
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2" aria-live="polite">
        <Submit label={value ? 'שמירה' : 'הוספת דוגמא'} />
        {state.message && <span className="text-sm text-green-700">{state.message}</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

/** שורה ברשימה; טופס העריכה נטען רק כשפותחים אותה */
export function DesignRow({ templateId, value }: { templateId: string; value: DesignValues }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-4 py-3" data-testid={`admin-design-${value.code}`}>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.imageUrl} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded border border-gray-100 bg-white object-contain" />
        <div className="min-w-0 flex-1 text-sm">
          <p>
            <span className="font-medium" dir="ltr">
              {value.code}
            </span>{' '}
            · {value.title}
            {!value.isActive && <span className="mr-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">מושבתת</span>}
          </p>
          {value.tags.length > 0 && <p className="text-xs text-gray-600">{value.tags.join(' · ')}</p>}
        </div>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-sm font-medium text-brand-700 hover:underline">
          {open ? 'סגירה' : `עריכה`}
          <span className="sr-only"> {value.code}</span>
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <DesignForm templateId={templateId} value={value} />
        </div>
      )}
    </li>
  );
}
