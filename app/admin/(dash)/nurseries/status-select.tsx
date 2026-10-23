'use client';

import type { NurseryStatus } from '@prisma/client';
import { NURSERY_STATUSES, NURSERY_STATUS_LABELS } from '@/lib/nursery-lifecycle';
import { setNurseryStatus } from './actions';

/** §2.03: שינוי סטטוס עם אישור (השעיה / ארכיון חוסמים את הבעלים והצוות ואת החנות). */
export function NurseryStatusSelect({ id, name, status }: { id: string; name: string; status: NurseryStatus }) {
  return (
    <form action={setNurseryStatus} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        aria-label={`סטטוס — ${name}`}
        onChange={(e) => {
          const to = e.target.value as NurseryStatus;
          const warn =
            to === 'SUSPENDED' || to === 'ARCHIVED'
              ? `\n\nהחנות תיסגר ללקוחות, והבעלים והצוות לא יוכלו להתחבר. הנתונים נשמרים.`
              : to === 'DRAFT'
                ? '\n\nהחנות לא תוצג ללקוחות (הבעלים ממשיך לעבוד).'
                : '';
          if (window.confirm(`לשנות את "${name}" ל"${NURSERY_STATUS_LABELS[to]}"?${warn}`)) e.currentTarget.form?.requestSubmit();
          else e.currentTarget.value = status;
        }}
        className="rounded-lg border border-gray-200 px-1.5 py-1 text-xs"
      >
        {NURSERY_STATUSES.map((s) => (
          <option key={s} value={s}>
            {NURSERY_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
