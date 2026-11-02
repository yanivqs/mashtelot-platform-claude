/**
 * מצב החשבון של משתלה מול הפלטפורמה. טהור — ללא Next/DB.
 *
 * החלטות בעלים (2026-11-02):
 * - חסימה רק לאדמין של המשתלה; החנות נשארת פתוחה ללקוחות.
 * - 3 ימי חסד אחרי תאריך החיוב או סוף התוקף, ואזהרה 7 ימים לפני.
 * - בלי חיוב אוטומטי: בחיוב חודשי התאריך מתקדם רק כשהסופר-אדמין מסמן "שולם".
 * - בלי תאריכים אין חסימה, כך שמשתלה בלי הגדרת חשבון ממשיכה לעבוד.
 */

export const GRACE_DAYS = 3;
export const WARNING_DAYS = 7;

export type AccountBlockReason = 'SUSPENDED' | 'OVERDUE' | 'EXPIRED';

export interface AccountBillingFields {
  billingDate: Date | null;
  validUntil: Date | null;
  billingType: 'ONE_TIME' | 'MONTHLY' | null;
  suspendedAt: Date | null;
  suspendReason?: string | null;
}

export type AccountStatus =
  | { state: 'OK' }
  /** dueInDays שלילי: בתוך ימי החסד */
  | { state: 'WARNING'; reason: 'OVERDUE' | 'EXPIRED'; dueDate: Date; dueInDays: number; blocksOn: Date }
  | { state: 'BLOCKED'; reason: AccountBlockReason; dueDate: Date | null; note: string | null };

const DAY = 24 * 60 * 60 * 1000;

/** היום בישראל כתאריך UTC בחצות, להשוואה לשדות תאריך בלבד (@db.Date). */
export function israelToday(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return new Date(`${parts}T00:00:00.000Z`);
}

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

export function accountStatus(a: AccountBillingFields | null, now = new Date()): AccountStatus {
  if (!a) return { state: 'OK' };
  if (a.suspendedAt) return { state: 'BLOCKED', reason: 'SUSPENDED', dueDate: null, note: a.suspendReason?.trim() || null };

  const today = israelToday(now);
  const candidates: Array<{ reason: 'OVERDUE' | 'EXPIRED'; date: Date }> = [];
  if (a.billingDate) candidates.push({ reason: 'OVERDUE', date: a.billingDate });
  if (a.billingType === 'ONE_TIME' && a.validUntil) candidates.push({ reason: 'EXPIRED', date: a.validUntil });
  if (candidates.length === 0) return { state: 'OK' };
  // המועד הקרוב ביותר קובע
  const next = candidates.reduce((x, y) => (y.date.getTime() < x.date.getTime() ? y : x));

  const dueInDays = daysBetween(today, next.date);
  if (dueInDays < -GRACE_DAYS) return { state: 'BLOCKED', reason: next.reason, dueDate: next.date, note: null };
  if (dueInDays <= WARNING_DAYS) return { state: 'WARNING', reason: next.reason, dueDate: next.date, dueInDays, blocksOn: addDays(next.date, GRACE_DAYS + 1) };
  return { state: 'OK' };
}

export function isAccountBlocked(a: AccountBillingFields | null, now = new Date()): boolean {
  return accountStatus(a, now).state === 'BLOCKED';
}

export const BLOCK_REASON_TEXT: Record<AccountBlockReason, string> = {
  SUSPENDED: 'החשבון הושהה על ידי מנהל הפלטפורמה.',
  OVERDUE: 'עבר מועד החיוב של החשבון.',
  EXPIRED: 'תוקף החשבון הסתיים.',
};

/** תאריך החיוב הבא בחיוב חודשי: אותו יום בחודש הבא; ביום שלא קיים בחודש — היום האחרון שלו. */
export function nextMonthlyBilling(d: Date): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

/** מה קורה לתאריך החיוב כשמסמנים "שולם": חודשי מתקדם, חד-פעמי נסגר. */
export function billingDateAfterPayment(a: { billingDate: Date | null; billingType: 'ONE_TIME' | 'MONTHLY' | null }, now = new Date()): Date | null {
  if (a.billingType !== 'MONTHLY') return null;
  const today = israelToday(now);
  let next = a.billingDate ? nextMonthlyBilling(a.billingDate) : nextMonthlyBilling(today);
  // תשלום אחרי פיגור של כמה חודשים: התאריך הבא תמיד בעתיד
  while (next.getTime() <= today.getTime()) next = nextMonthlyBilling(next);
  return next;
}

/** DD/MM/YYYY */
export function formatAccountDate(d: Date | null | undefined): string {
  if (!d) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** YYYY-MM-DD לשדה תאריך בטופס */
export function dateInputValue(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

/** קריאת תאריך מטופס. ריק או לא תקין — null. */
export function parseDateInput(v: unknown): Date | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

export const PAYMENT_METHOD_LABELS = { TRANSFER: 'העברה', CASH: 'מזומן', CARD: 'אשראי' } as const;
export const BILLING_TYPE_LABELS = { ONE_TIME: 'חד פעמי', MONTHLY: 'חודשי' } as const;
