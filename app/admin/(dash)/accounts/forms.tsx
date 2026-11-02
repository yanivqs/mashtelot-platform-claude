'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { ADDON_GROUPS, ADDONS, BASE_PARTS } from '@/lib/modules';
import { formatPrice } from '@/lib/utils';
import { markPaidAction, saveAccountAction, saveContactAction, setSuspensionAction, type AccountFormState } from './actions';

const initial: AccountFormState = {};
const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const fee = 'w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500';

const DESIGN_FLAGS: { key: string; label: string }[] = [
  { key: 'colors', label: 'צבעים' },
  { key: 'hero', label: 'Hero' },
  { key: 'carousel', label: 'קרוסלת תמונות' },
  { key: 'popup', label: 'פופ-אפ' },
  { key: 'sticky', label: 'כותרת נדבקת' },
];

function Submit({ label, cls = 'bg-brand-700 text-white hover:bg-brand-800' }: { label: string; cls?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${cls}`}>
      {pending ? 'שומר...' : label}
    </button>
  );
}

function Status({ state, okText = 'נשמר ✓' }: { state: AccountFormState; okText?: string }) {
  return (
    <>
      {state.ok && <span className="text-sm text-green-700">{okText}</span>}
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </>
  );
}

export interface ModuleRowVM {
  enabled: boolean;
  setupFee: string;
  monthlyFee: string;
  config: Record<string, unknown>;
}

export interface AccountVM {
  nurseryId: string;
  joinedAt: string;
  billingDate: string;
  amountDue: string;
  paymentMethod: string;
  billingType: string;
  validUntil: string;
  baseSetupFee: string;
  baseMonthlyFee: string;
  notes: string;
  salesMode: string;
  modules: Record<string, ModuleRowVM>;
}

export function AccountForm({ a }: { a: AccountVM }) {
  const [state, action] = useActionState(saveAccountAction, initial);
  const keep = useKeepFormValues(state);
  const [billingType, setBillingType] = useState(a.billingType);
  const [amount, setAmount] = useState(a.amountDue);
  const [base, setBase] = useState({ setup: a.baseSetupFee, monthly: a.baseMonthlyFee });
  const [mods, setMods] = useState(a.modules);

  const row = (key: string): ModuleRowVM => mods[key] ?? { enabled: false, setupFee: '0', monthlyFee: '0', config: {} };
  const patch = (key: string, p: Partial<ModuleRowVM>) => setMods((m) => ({ ...m, [key]: { ...row(key), ...p } }));
  const enabled = ADDONS.filter((m) => row(m.key).enabled);
  const sum = (pick: (r: ModuleRowVM) => string, b: string) => Number(b || 0) + enabled.reduce((s, m) => s + Number(pick(row(m.key)) || 0), 0);
  const totalSetup = sum((r) => r.setupFee, base.setup);
  const totalMonthly = sum((r) => r.monthlyFee, base.monthly);

  return (
    <form ref={keep} action={action} className="space-y-6">
      <input type="hidden" name="nurseryId" value={a.nurseryId} />

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">מודולים ועלויות</h2>
        <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">מערכת בסיס (תמיד פעילה)</p>
              <p className="mt-0.5 text-xs text-gray-600">{BASE_PARTS.join(' · ')}</p>
            </div>
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">הקמה ₪</span>
              <input name="baseSetupFee" type="number" step="0.01" min="0" value={base.setup} aria-label="עלות הקמה: מערכת בסיס" onChange={(e) => setBase((b) => ({ ...b, setup: e.target.value }))} className={fee} />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-gray-600">חודשי ₪</span>
              <input name="baseMonthlyFee" type="number" step="0.01" min="0" value={base.monthly} aria-label="עלות חודשית: מערכת בסיס" onChange={(e) => setBase((b) => ({ ...b, monthly: e.target.value }))} className={fee} />
            </label>
          </div>
          <label className="mt-3 block text-xs text-gray-700">
            מצב מכירה:{' '}
            <select name="sales_mode" defaultValue={a.salesMode} className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs">
              <option value="ONLINE">הזמנה אונליין</option>
              <option value="QUOTE">הצעת מחיר בלבד</option>
            </select>
          </label>
        </div>

        {ADDON_GROUPS.map((group) => (
          <div key={group} className="mt-4">
            <h3 className="mb-1.5 text-sm font-bold text-gray-800">{group}</h3>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {ADDONS.filter((m) => m.group === group).map((m) => {
                const r = row(m.key);
                return (
                  <div key={m.key} className="p-3" data-testid={`module-${m.key}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex min-w-48 flex-1 items-start gap-2">
                        <input type="checkbox" name={`mod_${m.key}`} checked={r.enabled} onChange={(e) => patch(m.key, { enabled: e.target.checked })} className="mt-0.5 h-4 w-4" aria-label={m.label} />
                        <span>
                          <span className="block text-sm font-medium">{m.label}</span>
                          <span className="block text-xs text-gray-600">{m.description}</span>
                        </span>
                      </label>
                      <label className="text-xs">
                        <span className="mb-0.5 block text-gray-600">הקמה ₪</span>
                        <input name={`setup_${m.key}`} type="number" step="0.01" min="0" value={r.setupFee} aria-label={`עלות הקמה: ${m.label}`} onChange={(e) => patch(m.key, { setupFee: e.target.value })} className={fee} />
                      </label>
                      <label className="text-xs">
                        <span className="mb-0.5 block text-gray-600">חודשי ₪</span>
                        <input name={`monthly_${m.key}`} type="number" step="0.01" min="0" value={r.monthlyFee} aria-label={`עלות חודשית: ${m.label}`} onChange={(e) => patch(m.key, { monthlyFee: e.target.value })} className={fee} />
                      </label>
                    </div>
                    {m.key === 'design' && r.enabled && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pr-6">
                        {DESIGN_FLAGS.map((f) => (
                          <label key={f.key} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <input type="checkbox" name={`design_${f.key}`} defaultChecked={r.config[f.key] !== false} className="h-3.5 w-3.5" />
                            {f.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm font-medium" data-testid="account-totals">
          סה״כ לפי המודולים הפעילים: הקמה {formatPrice(totalSetup)} · חודשי {formatPrice(totalMonthly)}
        </p>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">פרטי חיוב</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">תחילת הצטרפות</span>
            <input name="joinedAt" type="date" defaultValue={a.joinedAt} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">צורת חיוב</span>
            <select name="billingType" value={billingType} onChange={(e) => setBillingType(e.target.value)} className={`${field} bg-white`}>
              <option value="">לא הוגדר</option>
              <option value="MONTHLY">חודשי</option>
              <option value="ONE_TIME">חד פעמי</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">תאריך חיוב</span>
            <input name="billingDate" type="date" defaultValue={a.billingDate} className={field} />
          </label>
          {billingType === 'ONE_TIME' && (
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">בתוקף עד</span>
              <input name="validUntil" type="date" defaultValue={a.validUntil} className={field} />
            </label>
          )}
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">סכום לתשלום ₪</span>
            <input name="amountDue" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            <span className="mt-1 flex flex-wrap gap-3 text-xs">
              <button type="button" onClick={() => setAmount(totalMonthly.toFixed(2))} className="text-brand-700 underline">מילוי: חודשי</button>
              <button type="button" onClick={() => setAmount((totalSetup + totalMonthly).toFixed(2))} className="text-brand-700 underline">מילוי: הקמה + חודשי</button>
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">צורת תשלום</span>
            <select name="paymentMethod" defaultValue={a.paymentMethod} className={`${field} bg-white`}>
              <option value="">לא הוגדר</option>
              <option value="TRANSFER">העברה</option>
              <option value="CASH">מזומן</option>
              <option value="CARD">אשראי</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-gray-700">הערות (פנימי)</span>
            <input name="notes" defaultValue={a.notes} className={field} />
          </label>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          אזהרה מוצגת 7 ימים לפני המועד. הגישה לניהול נחסמת 3 ימים אחריו, והחנות נשארת פתוחה. בלי תאריכים אין חסימה.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Submit label="שמירת החשבון" />
        <Status state={state} />
      </div>
    </form>
  );
}

export function MarkPaidForm({ nurseryId, nextText }: { nurseryId: string; nextText: string }) {
  const [state, action] = useActionState(markPaidAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="nurseryId" value={nurseryId} />
      <Submit label="סומן כשולם" />
      <span className="text-xs text-gray-600">{nextText}</span>
      <Status state={state} okText="התשלום נרשם ✓" />
    </form>
  );
}

export function SuspensionForm({ nurseryId, suspended, reason }: { nurseryId: string; suspended: boolean; reason: string | null }) {
  const [state, action] = useActionState(setSuspensionAction, initial);
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="space-y-2">
      <input type="hidden" name="nurseryId" value={nurseryId} />
      {suspended ? (
        <>
          <p className="text-sm text-amber-900">החשבון מושהה{reason ? `: ${reason}` : ''}. החנות נשארת פתוחה ללקוחות.</p>
          <input type="hidden" name="intent" value="resume" />
          <Submit label="חידוש החשבון" />
        </>
      ) : (
        <>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">סיבת ההשהיה (מוצגת למשתלה)</span>
            <input name="reason" maxLength={500} className={field} />
          </label>
          <input type="hidden" name="intent" value="suspend" />
          <Submit label="השהיית החשבון" cls="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50" />
          <p className="text-xs text-gray-600">מנהל המשתלה יראה רק את הסיבה ופרטי הקשר. החנות נשארת פתוחה. כדי לסגור גם את החנות, השתמשו בהשעיית משתלה במסך &quot;משתלות&quot;.</p>
        </>
      )}
      <Status state={state} />
    </form>
  );
}

export function ContactForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action] = useActionState(saveContactAction, initial);
  const keep = useKeepFormValues(state);
  return (
    <form ref={keep} action={action} className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם</span>
        <input name="contactName" defaultValue={name} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">טלפון</span>
        <input name="contactPhone" dir="ltr" defaultValue={phone} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">מייל</span>
        <input name="contactEmail" dir="ltr" defaultValue={email} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Submit label="שמירת פרטי קשר" />
        <Status state={state} />
      </div>
    </form>
  );
}
