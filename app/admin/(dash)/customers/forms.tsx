'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addNoteAction, exportCustomersAction, groupAction, updateCustomerAction, type CrmState } from './actions';

const initial: CrmState = {};
const field = 'rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? '...' : label}
    </button>
  );
}

/** יצוא CSV של הסינון הנוכחי — רק לקוחות שהסכימו לדיוור. */
export function ExportButton({ params }: { params: Record<string, string> }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await exportCustomersAction(params);
          setBusy(false);
          if (r.error || r.csv === undefined) return setMsg(r.error ?? 'שגיאה');
          const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          setMsg(`יוצאו ${r.count} לקוחות שהסכימו לדיוור`);
        }}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60"
      >
        {busy ? '...' : 'יצוא לשיווק (CSV)'}
      </button>
      {msg && <span className="text-xs text-gray-600" data-testid="export-msg">{msg}</span>}
    </div>
  );
}

export function GroupForm() {
  const [state, action] = useActionState(groupAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="op" value="create" />
      <input name="name" required placeholder="שם קבוצה חדשה" aria-label="שם קבוצה חדשה" className={field} />
      <Submit label="הוספת קבוצה" />
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}

export function DeleteGroupButton({ id, name }: { id: string; name: string }) {
  const [, action] = useActionState(groupAction, initial);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`למחוק את הקבוצה "${name}"? הלקוחות יישארו בלי קבוצה.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="op" value="delete" />
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-rose-700 hover:underline" aria-label={`מחיקת קבוצה ${name}`}>
        ✕
      </button>
    </form>
  );
}

export function CustomerCrmForm({
  email,
  groups,
  value,
}: {
  email: string;
  groups: Array<{ id: string; name: string }>;
  value: { tags: string[]; groupId: string | null; type: 'PRIVATE' | 'BUSINESS'; companyName: string | null; taxId: string | null };
}) {
  const [state, action] = useActionState(updateCustomerAction, initial);
  const [type, setType] = useState(value.type);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">תגיות (מופרדות בפסיק)</span>
          <input name="tags" defaultValue={value.tags.join(', ')} className={`${field} w-full`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">קבוצה</span>
          <select name="groupId" defaultValue={value.groupId ?? ''} className={`${field} w-full`}>
            <option value="">ללא</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-700">סוג לקוח</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as 'PRIVATE' | 'BUSINESS')} className={`${field} w-full`}>
            <option value="PRIVATE">פרטי</option>
            <option value="BUSINESS">עסקי</option>
          </select>
        </label>
        {type === 'BUSINESS' && (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">שם החברה</span>
              <input name="companyName" defaultValue={value.companyName ?? ''} className={`${field} w-full`} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">ח.פ. / עוסק</span>
              <input name="taxId" defaultValue={value.taxId ?? ''} dir="ltr" className={`${field} w-full`} />
            </label>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Submit label="שמירה" />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function NoteForm({ email }: { email: string }) {
  const [state, action] = useActionState(addNoteAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="email" value={email} />
      <textarea name="body" rows={2} required placeholder="הערה פנימית (הלקוח לא רואה)" aria-label="הערה חדשה" className={`${field} w-full`} />
      <div className="flex items-center gap-3">
        <Submit label="הוספת הערה" />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
