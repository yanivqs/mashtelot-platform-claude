'use client';

import { useActionState, useState, useTransition } from 'react';
import type { AccessibilityReportStatus } from '@prisma/client';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { REPORT_STATUS_LABELS, type NurseryAccessibilityInfo } from '@/lib/accessibility';
import { saveAccessibilityInfoAction, updateReportAction, type InfoState } from './actions';

const initial: InfoState = {};
const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500';
const label = 'block text-sm font-medium text-gray-800';

export function AccessibilityInfoForm({ info }: { info: NurseryAccessibilityInfo }) {
  const [state, action, pending] = useActionState(saveAccessibilityInfoAction, initial);
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="space-y-4">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold text-gray-900">רכז/ת נגישות</legend>
        <label className={label}>
          שם
          <input name="coordinatorName" defaultValue={info.coordinatorName} maxLength={120} className={input} />
        </label>
        <label className={label}>
          טלפון
          <input name="coordinatorPhone" defaultValue={info.coordinatorPhone} maxLength={30} dir="ltr" className={input} />
        </label>
        <label className={label}>
          אימייל
          <input name="coordinatorEmail" type="email" defaultValue={info.coordinatorEmail} maxLength={200} dir="ltr" className={input} />
        </label>
      </fieldset>
      <p className="text-xs text-gray-500">חובה למי שמעסיק 25 עובדים ומעלה. בלי רכז, ההצהרה תציג את פרטי הקשר של המשתלה.</p>
      <label className={label}>
        הסדרי הנגישות במשתלה עצמה
        <textarea name="physicalArrangements" defaultValue={info.physicalArrangements} maxLength={2000} rows={3} placeholder="למשל: חניית נכים בכניסה, שבילים רחבים לכיסא גלגלים, עזרה בנשיאה לרכב" className={input} />
      </label>
      <label className={label}>
        דרכי שירות חלופיות
        <textarea name="alternatives" defaultValue={info.alternatives} maxLength={1000} rows={2} placeholder="למשל: אפשר להזמין גם בטלפון" className={input} />
      </label>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-gray-900">בדיקה ידנית, אם נעשתה</legend>
        <label className={label}>
          מי בדק
          <input name="auditedBy" defaultValue={info.auditedBy} maxLength={200} className={input} />
        </label>
        <label className={label}>
          תאריך הבדיקה
          <input name="auditedAt" type="date" defaultValue={info.auditedAt} dir="ltr" className={input} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          נבדק עם (קוראי מסך ודפדפנים)
          <input name="testedWith" defaultValue={info.testedWith} maxLength={300} placeholder="למשל: NVDA ו-Chrome, VoiceOver ו-Safari" className={input} />
        </label>
      </fieldset>
      <p className="text-xs text-gray-500">כתבו רק מה שנבדק בפועל. הפרטים מוצגים בהצהרה, ותאריך בדיקה מסיר ממנה את ההערה שהאתר טרם נבדק ידנית.</p>
      <label className={`${label} max-w-xs`}>
        צד כפתור הנגישות בחנות
        <select name="buttonSide" defaultValue={info.buttonSide} className={input}>
          <option value="left">שמאל</option>
          <option value="right">ימין</option>
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
          {pending ? 'שומר...' : 'שמירה'}
        </button>
        {state.ok && (
          <span role="status" className="text-sm text-green-800" data-testid="a11y-info-saved">
            נשמר ✓
          </span>
        )}
        {state.error && (
          <span role="alert" className="text-sm text-red-700">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

export function ReportControls({ id, status, note }: { id: string; status: AccessibilityReportStatus; note: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 space-y-2"
      action={(fd) =>
        start(async () => {
          const r = await updateReportAction(id, fd);
          setError(r.error ?? null);
        })
      }
    >
      <label className={label}>
        מה נעשה (פנימי)
        <textarea name="handlingNote" defaultValue={note ?? ''} maxLength={2000} rows={2} className={input} />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <label className={label}>
          סטטוס
          <select name="status" defaultValue={status} className={input}>
            {(Object.keys(REPORT_STATUS_LABELS) as AccessibilityReportStatus[]).map((s) => (
              <option key={s} value={s}>
                {REPORT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60">
          {pending ? '...' : 'עדכון'}
        </button>
        {error && (
          <span role="alert" className="text-sm text-red-700">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
