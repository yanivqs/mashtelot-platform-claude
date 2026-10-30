'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MAX_OPENING_HOURS_ROWS, type OpeningHoursRow } from '@/lib/theme';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

/** שעות פעילות — שורה לכל יום/טווח ימים: "ימים" + "שעות". נשלח כ-JSON בשדה מוסתר. */
export function OpeningHoursEditor({ initial }: { initial: OpeningHoursRow[] }) {
  const [rows, setRows] = useState<OpeningHoursRow[]>(initial.length ? initial : [{ label: '', value: '' }]);
  const set = (i: number, patch: Partial<OpeningHoursRow>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-2 sm:col-span-2">
      <span className="block text-sm font-medium text-gray-700">שעות פעילות</span>
      <input type="hidden" name="openingHoursJson" value={JSON.stringify(rows.filter((r) => r.label.trim() && r.value.trim()))} />
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2" data-testid="hours-row">
          <input
            aria-label={`ימים ${i + 1}`}
            value={row.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="ראשון - חמישי"
            maxLength={60}
            className={field}
          />
          <input
            aria-label={`שעות ${i + 1}`}
            value={row.value}
            onChange={(e) => set(i, { value: e.target.value })}
            placeholder="09:00-17:00 או סגור"
            maxLength={60}
            className={field}
          />
          <button
            type="button"
            onClick={() => setRows((r) => (r.length > 1 ? r.filter((_, j) => j !== i) : [{ label: '', value: '' }]))}
            aria-label={`מחיקת שורה ${i + 1}`}
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {rows.length < MAX_OPENING_HOURS_ROWS && (
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { label: '', value: '' }])}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
        >
          <Plus className="h-4 w-4" />
          הוספת שורה
        </button>
      )}
    </div>
  );
}
