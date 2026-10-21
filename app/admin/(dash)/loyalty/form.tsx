'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveLoyaltySettings, type LoyaltyState } from './actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? '...' : 'שמירה'}
    </button>
  );
}

export function LoyaltySettingsForm({ value }: { value: { pointsPerShekel: number; pointValue: number; maxRedeemPct: number } }) {
  const [state, action] = useActionState(saveLoyaltySettings, {} as LoyaltyState);
  const v = state.values ?? { pointsPerShekel: String(value.pointsPerShekel), pointValue: value.pointValue ? String(value.pointValue) : '', maxRedeemPct: String(value.maxRedeemPct) };
  const [pps, setPps] = useState(v.pointsPerShekel);
  const [pv, setPv] = useState(v.pointValue);
  const back = Number(pps) * Number(pv) * 100;

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">נקודות לכל ₪1</span>
          <input name="pointsPerShekel" type="number" min="0" max="100" step="0.1" value={pps} onChange={(e) => setPps(e.target.value)} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">שווי נקודה (₪)</span>
          <input name="pointValue" type="number" min="0" max="100" step="0.01" value={pv} onChange={(e) => setPv(e.target.value)} placeholder="למשל 0.05" className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מימוש עד (% מההזמנה)</span>
          <input name="maxRedeemPct" type="number" min="0" max="100" step="1" defaultValue={v.maxRedeemPct} className={field} />
        </label>
      </div>
      <p className="text-sm text-gray-600" data-testid="loyalty-summary">
        {Number(pv) > 0
          ? `הלקוח מקבל בחזרה כ-${back.toFixed(1)}% מסכום הקנייה בנקודות.`
          : 'שווי הנקודה הוא 0 — צבירה ומימוש כבויים עד שתגדירו שווי.'}
      </p>
      <div className="flex items-center gap-3">
        <Submit />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
