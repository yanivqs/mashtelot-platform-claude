'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { deleteMyAccountAction, exportMyDataAction, requestCodeAction, updateProfileAction, verifyCodeAction, type AccountState } from './actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand,#16a34a)]';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded-lg bg-[var(--brand,#16a34a)] py-2.5 text-sm font-medium text-white transition hover:brightness-95 disabled:opacity-60"
    >
      {pending ? '...' : label}
    </button>
  );
}

/** כניסה בשני שלבים: מייל → קוד. */
export function LoginForm({ tenant }: { tenant: string }) {
  const router = useRouter();
  const [req, reqAction] = useActionState(requestCodeAction, {} as AccountState);
  const [ver, verAction] = useActionState(verifyCodeAction, {} as AccountState);
  const sentTo = ver.sentTo ?? req.sentTo;

  useEffect(() => {
    if (ver.ok) router.refresh();
  }, [ver.ok, router]);

  if (!sentTo) {
    return (
      <form action={reqAction} className="space-y-3">
        <input type="hidden" name="tenant" value={tenant} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">אימייל</span>
          <input name="email" type="email" required autoComplete="email" dir="ltr" className={field} />
        </label>
        {req.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{req.error}</p>}
        <Submit label="שליחת קוד" />
      </form>
    );
  }

  return (
    <form action={verAction} className="space-y-3">
      <input type="hidden" name="tenant" value={tenant} />
      <input type="hidden" name="email" value={sentTo} />
      <p className="text-sm text-gray-600">
        שלחנו קוד בן 6 ספרות אל <span dir="ltr">{sentTo}</span>. הוא תקף ל-10 דקות.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">קוד</span>
        <input
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          className={`${field} text-center font-mono text-lg tracking-widest`}
        />
      </label>
      {ver.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{ver.error}</p>}
      <Submit label="כניסה" />
      <button type="button" onClick={() => window.location.reload()} className="w-full text-center text-xs text-gray-500 hover:underline">
        מייל אחר / שליחה מחדש
      </button>
    </form>
  );
}

export function ProfileForm({
  tenant,
  profile,
  nurseryName,
}: {
  tenant: string;
  profile: { fullName: string; phone: string; consent: boolean };
  nurseryName: string;
}) {
  const [state, action] = useActionState(updateProfileAction, {} as AccountState);
  const v = { ...profile, ...(state.values ?? {}) };
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenant" value={tenant} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">שם מלא</span>
          <input name="fullName" defaultValue={v.fullName} autoComplete="name" className={field} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">טלפון</span>
          <input name="phone" defaultValue={v.phone} autoComplete="tel" inputMode="tel" dir="ltr" className={field} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input name="marketingConsent" type="checkbox" defaultChecked={profile.consent} className="mt-0.5 h-4 w-4" />
        אני מסכים/ה לקבל עדכונים ומבצעים מ{nurseryName} במייל. אפשר לבטל בכל עת.
      </label>
      <div className="flex items-center gap-3">
        <div className="w-40">
          <Submit label="שמירה" />
        </div>
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

/** R06-09: הורדת המידע ומחיקת החשבון. */
export function PrivacySection({ tenant }: { tenant: string }) {
  // הצלחה — הדף מתרענן למסך כניסה עם הודעה (עוגיית Flash מהשרת)
  const [state, action] = useActionState(deleteMyAccountAction, {} as AccountState);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await exportMyDataAction(tenant);
            setBusy(false);
            if (!r.json) return setErr(r.error ?? 'שגיאה');
            const url = URL.createObjectURL(new Blob([r.json], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'my-data.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? '...' : 'הורדת המידע שלי'}
        </button>
        <p className="mt-1 text-xs text-gray-500">קובץ עם הפרטים, הכתובות, ההזמנות, המועדפים והנקודות שלכם בחנות הזו.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
      <form action={action} className="space-y-2 rounded-lg border border-rose-100 bg-rose-50/40 p-3">
        <input type="hidden" name="tenant" value={tenant} />
        <p className="text-sm font-medium text-rose-800">מחיקת החשבון</p>
        <p className="text-xs text-gray-600">
          החשבון, הכתובות, המועדפים והנקודות יימחקו. ההזמנות נשמרות אצל המשתלה לצורכי הנהלת חשבונות — בלי השם, המייל, הטלפון והכתובת שלכם.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="confirm" className="h-4 w-4" /> אני מבין/ה שהמחיקה סופית
        </label>
        <button className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50">מחיקת החשבון</button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </div>
  );
}
