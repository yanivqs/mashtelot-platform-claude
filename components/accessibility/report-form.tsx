'use client';

import { useActionState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { submitAccessibilityReport, type ReportState } from '@/app/[tenant]/accessibility/actions';

const initial: ReportState = {};
const field = 'mt-1 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-brand-700';

/** דיווח על בעיית נגישות מהחנות. עובד גם בלי קוד בצד הלקוח. */
export function AccessibilityReportForm({ tenant }: { tenant: string }) {
  const [state, action, pending] = useActionState(submitAccessibilityReport, initial);
  const keep = useKeepFormValues(state);

  return (
    <section id="report" aria-labelledby="report-title" className="mt-8 scroll-mt-24 rounded-xl border border-gray-300 p-5">
      <h2 id="report-title" className="text-xl font-bold text-gray-900">
        דיווח על בעיית נגישות
      </h2>
      {state.ok ? (
        <p role="status" className="mt-3 font-medium text-gray-900">
          תודה, הפנייה התקבלה. נחזור אליכם בפרטים שהשארתם.
        </p>
      ) : (
        <form ref={keep} action={action} className="mt-3 space-y-3">
          <input type="hidden" name="tenant" value={tenant} />
          <div className="sr-only" aria-hidden="true">
            <label>
              אתר
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-900">
            מה הבעיה? (חובה)
            <textarea name="description" required minLength={5} maxLength={3000} rows={4} className={field} />
          </label>
          <label className="block text-sm font-medium text-gray-900">
            באיזה עמוד? (לא חובה)
            <input type="text" name="pageUrl" maxLength={500} className={field} />
          </label>
          <label className="block text-sm font-medium text-gray-900">
            שם (לא חובה)
            <input type="text" name="contactName" autoComplete="name" maxLength={120} className={field} />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-gray-900">איך לחזור אליכם? (לפחות אחד מהשניים)</legend>
            <label className="mt-2 block text-sm text-gray-900">
              אימייל
              <input type="email" name="contactEmail" dir="ltr" autoComplete="email" maxLength={200} className={field} />
            </label>
            <label className="mt-2 block text-sm text-gray-900">
              טלפון
              <input type="tel" name="contactPhone" dir="ltr" autoComplete="tel" maxLength={30} className={field} />
            </label>
          </fieldset>
          {state.error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {state.error}
            </p>
          )}
          <button type="submit" disabled={pending} className="rounded-lg bg-brand-700 px-5 py-2.5 font-medium text-white hover:bg-brand-800 disabled:opacity-60">
            {pending ? 'שולח...' : 'שליחת הדיווח'}
          </button>
          <p className="text-xs text-gray-600">הפרטים ישמשו רק לטיפול בפנייה.</p>
        </form>
      )}
    </section>
  );
}
