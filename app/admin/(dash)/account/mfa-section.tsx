'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import {
  cancelMfaSetupAction,
  confirmMfaAction,
  disableMfaAction,
  regenerateCodesAction,
  startMfaAction,
  type MfaState,
} from './mfa-actions';

const initial: MfaState = {};
const field = 'rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Btn({ label, cls = 'bg-brand-600 text-white hover:bg-brand-700' }: { label: string; cls?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${cls}`}>
      {pending ? '...' : label}
    </button>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="mb-2 text-sm font-medium text-amber-900">קודי שחזור — שמרו אותם עכשיו במקום בטוח. הם לא יוצגו שוב.</p>
      <p className="mb-3 text-xs text-amber-800">כל קוד משמש פעם אחת, להתחברות כשאין גישה לאפליקציית האימות.</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm" dir="ltr" data-testid="recovery-codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

function CodeInput({ label = 'קוד מהאפליקציה או קוד שחזור' }: { label?: string }) {
  return <input name="code" required autoComplete="one-time-code" dir="ltr" maxLength={16} aria-label={label} placeholder="123456" className={`${field} w-40 text-center font-mono`} />;
}

/** אימות דו-שלבי (§4.04) — הפעלה עם QR, קודי שחזור, ביטול. כל שלב נאכף שוב בשרת. */
export function MfaSection({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const [start, startAction] = useActionState(startMfaAction, initial);
  const [confirm, confirmAction] = useActionState(confirmMfaAction, initial);
  const [cancel, cancelAction] = useActionState(cancelMfaSetupAction, initial);
  const [disable, disableAction] = useActionState(disableMfaAction, initial);
  const [regen, regenAction] = useActionState(regenerateCodesAction, initial);

  // ביטול / ביטול הפעלה — טעינה מחדש של המצב מהשרת (פשוט ובטוח יותר ממעקב אחר כמה states)
  useEffect(() => {
    if (disable.ok || cancel.ok) window.location.reload();
  }, [disable.ok, cancel.ok]);

  const codes = confirm.recoveryCodes ?? regen.recoveryCodes;
  // בשגיאת אישור — ה-QR חוזר מה-state של האישור
  const setup = confirm.qr ? confirm : start.qr && !confirm.ok ? start : null;

  if (enabled || confirm.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">פעיל</span>{' '}
          בכל התחברות תתבקשו להזין קוד מאפליקציית האימות.
          {!codes && <span className="text-gray-500"> נותרו {recoveryLeft} קודי שחזור.</span>}
        </p>
        {codes && <RecoveryCodes codes={codes} />}
        <form action={regenAction} className="flex flex-wrap items-center gap-2">
          <CodeInput label="קוד ליצירת קודי שחזור חדשים" />
          <Btn label="קודי שחזור חדשים" cls="border border-gray-300 bg-white text-gray-800 hover:bg-gray-50" />
          {regen.error && <span className="text-sm text-red-600">{regen.error}</span>}
        </form>
        <form action={disableAction} className="flex flex-wrap items-center gap-2">
          <CodeInput label="קוד לביטול האימות הדו-שלבי" />
          <Btn label="ביטול אימות דו-שלבי" cls="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50" />
          {disable.error && <span className="text-sm text-red-600">{disable.error}</span>}
        </form>
      </div>
    );
  }

  if (setup) {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pr-5 text-sm text-gray-700">
          <li>פתחו אפליקציית אימות (Google Authenticator, Microsoft Authenticator וכו׳) וסרקו את הקוד.</li>
          <li>הזינו את הקוד בן 6 הספרות שמופיע באפליקציה.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL שנוצר בשרת */}
        <img src={setup.qr} alt="קוד QR להפעלת אימות דו-שלבי" width={220} height={220} className="rounded-lg border border-gray-100" />
        <p className="text-xs text-gray-500">
          לא מצליחים לסרוק? הקלידו את המפתח:{' '}
          <code dir="ltr" className="select-all rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-800" data-testid="mfa-secret">
            {setup.secret}
          </code>
        </p>
        <form action={confirmAction} className="flex flex-wrap items-center gap-2">
          <CodeInput label="קוד מהאפליקציה לאישור" />
          <Btn label="אישור והפעלה" />
          {confirm.error && <span className="text-sm text-red-600">{confirm.error}</span>}
        </form>
        <form action={cancelAction}>
          <button className="text-xs text-gray-500 hover:underline">ביטול</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">כבוי</span> הגנה נוספת: גם מי שיודע את הסיסמה לא
        ייכנס בלי קוד מהטלפון שלכם.
      </p>
      <form action={startAction}>
        <Btn label="הפעלת אימות דו-שלבי" />
      </form>
      {start.error && <p className="text-sm text-red-600">{start.error}</p>}
    </div>
  );
}
