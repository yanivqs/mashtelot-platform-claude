'use client';

import { useState, useTransition } from 'react';
import { exportSubscribersAction, removeSubscriberAction } from './actions';

export function ExportSubscribers() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await exportSubscribersAction();
          setBusy(false);
          if (r.error || r.csv === undefined) return setMsg(r.error ?? 'שגיאה');
          const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          setMsg(`יוצאו ${r.count} כתובות`);
        }}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60"
      >
        {busy ? '...' : 'יצוא לקובץ CSV'}
      </button>
      {msg && (
        <span className="text-xs text-gray-600" data-testid="newsletter-export-msg">
          {msg}
        </span>
      )}
    </div>
  );
}

export function RemoveSubscriber({ id, email }: { id: string; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-label={`הסרת ${email} מהתפוצה`}
        onClick={() => {
          if (!window.confirm(`להסיר את ${email} מהתפוצה?`)) return;
          start(async () => setError((await removeSubscriberAction(id)).error ?? null));
        }}
        className="text-xs text-red-700 hover:underline disabled:opacity-60"
      >
        הסרה
      </button>
      {error && <span className="ms-2 text-xs text-red-700">{error}</span>}
    </>
  );
}
