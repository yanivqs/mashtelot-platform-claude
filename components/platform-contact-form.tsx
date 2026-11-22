'use client';

import { useActionState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { submitPlatformLead, type LeadState } from '@/app/contact-actions';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';

const field = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200';

/** טופס "צור קשר" לבעלי משתלות, בדף הנחיתה של הפלטפורמה. */
export function PlatformContactForm() {
  const [state, action, pending] = useActionState<LeadState, FormData>(submitPlatformLead, {});
  // אחרי שגיאה React מאפס את הטופס — מחזירים את מה שהפונה כבר מילא
  const keep = useKeepFormValues(state);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-8 text-center" role="status" data-testid="lead-sent">
        <CheckCircle2 className="h-10 w-10 text-brand-700" aria-hidden />
        <p className="text-lg font-bold text-brand-900">תודה! הפרטים התקבלו</p>
        <p className="text-sm text-gray-700">נחזור אליכם בהקדם.</p>
      </div>
    );
  }

  return (
    <form ref={keep} action={action} className="grid gap-4 rounded-xl border border-gray-100 bg-white p-6 text-right shadow-sm sm:grid-cols-2" noValidate>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          שם איש קשר <span aria-hidden>*</span>
        </span>
        <input name="contactName" required autoComplete="name" maxLength={100} className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          שם המשתלה <span aria-hidden>*</span>
        </span>
        <input name="nurseryName" required autoComplete="organization" maxLength={120} className={field} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          טלפון <span aria-hidden>*</span>
        </span>
        <input name="phone" type="tel" required autoComplete="tel" dir="ltr" maxLength={30} className={`${field} text-right`} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">
          אימייל <span aria-hidden>*</span>
        </span>
        <input name="email" type="email" required autoComplete="email" dir="ltr" maxLength={200} className={`${field} text-right`} />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">הערות</span>
        <textarea name="notes" rows={4} maxLength={2000} className={field} />
      </label>
      {/* מלכודת לבוטים: מוסתר מאנשים ומקוראי מסך */}
      <div className="sr-only" aria-hidden="true">
        <label>
          אתר
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden />
          {pending ? 'שולח…' : 'שליחה'}
        </button>
        <p className="text-sm text-red-700" role="alert">
          {state.error ?? ''}
        </p>
      </div>
    </form>
  );
}
