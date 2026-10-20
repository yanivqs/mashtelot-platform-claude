'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addMemberAction, memberAction, type TeamState } from './actions';

const initial: TeamState = {};
const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const ROLE_OPTIONS = [
  { value: 'NURSERY_STAFF', label: 'עובד — כל הניהול' },
  { value: 'NURSERY_WRITER', label: 'כותב תוכן — עמודים ובלוג' },
];

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? '...' : label}
    </button>
  );
}

export function AddMemberForm({ minPassword, full }: { minPassword: number; full: boolean }) {
  const [state, action] = useActionState(addMemberAction, initial);
  const v = state.values ?? {};
  if (full) return <p className="text-sm text-amber-800">הגעתם למגבלת העובדים הפעילים. השביתו עובד כדי להוסיף חדש.</p>;
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">אימייל (שם משתמש)</span>
          <input name="email" type="email" required dir="ltr" defaultValue={v.email} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">שם</span>
          <input name="fullName" defaultValue={v.fullName} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">תפקיד</span>
          <select name="role" defaultValue={v.role || 'NURSERY_STAFF'} className={field}>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">סיסמה (לפחות {minPassword} תווים)</span>
          <input name="password" type="password" required minLength={minPassword} autoComplete="new-password" className={field} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Submit label="הוספת עובד" />
        {state.ok && <span className="text-sm text-green-700">נוסף ✓ — מסרו לעובד את האימייל והסיסמה</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export interface MemberVM {
  id: string;
  email: string;
  fullName: string | null;
  role: 'NURSERY_STAFF' | 'NURSERY_WRITER';
  disabled: boolean;
}

export function MemberRow({ m, minPassword }: { m: MemberVM; minPassword: number }) {
  const [state, action] = useActionState(memberAction, initial);
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm ${m.disabled ? 'opacity-70' : ''}`} data-testid="team-member">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium" dir="ltr">
          {m.email}
        </span>
        {m.fullName && <span className="text-sm text-gray-500">{m.fullName}</span>}
        <span className={`rounded-full px-2 py-0.5 text-xs ${m.disabled ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'}`}>
          {m.disabled ? 'מושבת' : 'פעיל'}
        </span>
        <form action={action} className="ms-auto">
          <input type="hidden" name="userId" value={m.id} />
          <input type="hidden" name="op" value={m.disabled ? 'enable' : 'disable'} />
          <button className={`text-xs ${m.disabled ? 'text-brand-700' : 'text-rose-700'} hover:underline`}>{m.disabled ? 'החזרה לפעילות' : 'השבתה'}</button>
        </form>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={m.id} />
          <input type="hidden" name="op" value="role" />
          <select name="role" defaultValue={m.role} aria-label={`תפקיד — ${m.email}`} className="rounded-lg border border-gray-200 px-2 py-1 text-xs">
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">שמירת תפקיד</button>
        </form>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={m.id} />
          <input type="hidden" name="op" value="password" />
          <input
            name="password"
            type="password"
            required
            minLength={minPassword}
            autoComplete="new-password"
            placeholder="סיסמה חדשה"
            aria-label={`סיסמה חדשה — ${m.email}`}
            className="w-40 rounded-lg border border-gray-200 px-2 py-1 text-xs"
          />
          <button className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">איפוס סיסמה</button>
        </form>
        {state.ok && <span className="text-xs text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </div>
  );
}
