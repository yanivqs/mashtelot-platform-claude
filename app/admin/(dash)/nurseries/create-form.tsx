'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { ImageUpload } from '@/components/admin/image-upload';
import { createNursery, type NurseryFormState } from './actions';

const initial: NurseryFormState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'יוצר...' : 'יצירת משתלה'}
    </button>
  );
}

export function CreateNurseryForm() {
  const [state, formAction] = useFormState(createNursery, initial);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם המשתלה</span>
        <input name="name" required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">תת-דומיין</span>
        <input name="subdomain" required placeholder="galim" className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">אימייל בעלים</span>
        <input name="ownerEmail" type="email" required className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">סיסמה ראשונית (אופציונלי)</span>
        <input name="ownerPassword" type="text" minLength={8} className={field} />
      </label>

      <div className="sm:col-span-2">
        <ImageUpload name="logoUrl" label="לוגו המשתלה (אופציונלי)" folder="logos" />
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton />
        {state.ok && <span className="text-sm text-green-700">נוצר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
