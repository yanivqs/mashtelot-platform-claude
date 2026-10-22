import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailConfigStatus } from '@/lib/email';
import { TestEmailForm } from './test-email-form';
import { JOB_LABELS, JOB_NAMES } from '@/lib/jobs';
import { retryEmailAction } from './actions';

export const dynamic = 'force-dynamic';

interface SendOutcome {
  to?: string | string[];
  ok?: boolean;
  skipped?: boolean;
  error?: string;
}

function Outcome({ label, r }: { label: string; r?: SendOutcome }) {
  if (!r) return null;
  const to = Array.isArray(r.to) ? r.to.join(', ') : r.to;
  return (
    <p className="text-xs">
      <span className="font-medium text-gray-700">{label}:</span> <span dir="ltr">{to}</span> ·{' '}
      {r.ok ? (
        <span className="text-green-700">נשלח</span>
      ) : r.skipped ? (
        <span className="text-amber-700">דולג (אין הגדרות)</span>
      ) : (
        <span dir="auto" className="text-red-700">
          נכשל — {r.error}
        </span>
      )}
    </p>
  );
}

function Row({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  const Icon = ok ? (warn ? AlertTriangle : CheckCircle2) : XCircle;
  const color = ok ? (warn ? 'text-amber-600' : 'text-green-600') : 'text-red-600';
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <span>{children}</span>
    </li>
  );
}

export default async function SystemPage() {
  const user = await requireUser(['SUPER_ADMIN']);
  // §21: מצב משימות הרקע ומיילים שנכשלו סופית
  const [lastRuns, failedRuns, failedEmails, pendingEmails] = await Promise.all([
    Promise.all(JOB_NAMES.map((name) => prisma.jobRun.findFirst({ where: { name }, orderBy: { startedAt: 'desc' } }))),
    prisma.jobRun.findMany({ where: { status: 'FAILED' }, orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.emailJob.findMany({ where: { status: 'FAILED' }, orderBy: { createdAt: 'desc' }, take: 20, include: { nursery: { select: { name: true } } } }),
    prisma.emailJob.count({ where: { status: 'PENDING' } }),
  ]);
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const cfg = emailConfigStatus();
  const events = await prisma.auditEvent.findMany({
    where: { action: { in: ['order.emails', 'email.test'] } },
    include: { nursery: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">מיילים ומערכת</h1>
        <p className="text-sm text-gray-500">אבחון שליחת מיילי הזמנות (Resend).</p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">תצורה</h2>
        <ul className="space-y-2">
          <Row ok={cfg.hasApiKey}>
            RESEND_API_KEY {cfg.hasApiKey ? 'מוגדר' : 'לא מוגדר — מיילים לא נשלחים כלל'}
          </Row>
          <Row ok={Boolean(cfg.from)} warn={cfg.usesSandboxSender}>
            EMAIL_FROM: <span dir="ltr">{cfg.from ?? 'לא מוגדר'}</span>
            {cfg.usesSandboxSender &&
              ' — כתובת resend.dev שולחת רק לבעל חשבון Resend. יש לאמת דומיין ולהשתמש בכתובת ממנו.'}
          </Row>
          <Row ok warn={cfg.adminCopy.length === 0}>
            עותק למנהל הפלטפורמה (ORDER_NOTIFY_EMAILS):{' '}
            <span dir="ltr">{cfg.adminCopy.join(', ') || 'לא מוגדר'}</span>
          </Row>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          הדומיין שבכתובת השולח חייב להיות מאומת ב-Resend (רשומות SPF/DKIM ב-DNS), אחרת Resend
          דוחה כל שליחה לנמען שאינו בעל החשבון. התראות הזמנה נשלחות לאימייל הבעלים ולאימייל
          יצירת הקשר של המשתלה.
        </p>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" data-testid="jobs">
        <h2 className="mb-1 font-bold">משימות רקע</h2>
        <p className="mb-3 text-xs text-gray-500">
          {cronConfigured ? 'מופעלות אוטומטית ב-Vercel Cron.' : 'CRON_SECRET לא מוגדר — המשימות לא רצות.'} מיילים בתור לשליחה חוזרת: {pendingEmails}
        </p>
        <ul className="space-y-1 text-sm">
          {JOB_NAMES.map((name, i) => {
            const r = lastRuns[i];
            return (
              <li key={name} className="flex flex-wrap items-center gap-2">
                {!r ? (
                  <AlertTriangle className="h-4 w-4 text-gray-400" />
                ) : r.status === 'FAILED' ? (
                  <XCircle className="h-4 w-4 text-rose-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                <span>{JOB_LABELS[name]}</span>
                <span className="text-xs text-gray-500">
                  {r ? `ריצה אחרונה ${r.startedAt.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}${r.result ? ` · ${JSON.stringify(r.result)}` : ''}` : 'עוד לא רצה'}
                </span>
              </li>
            );
          })}
        </ul>
        {failedRuns.length > 0 && (
          <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800">
            <p className="mb-1 font-medium">ריצות שנכשלו</p>
            {failedRuns.map((r) => (
              <p key={r.id}>
                {r.startedAt.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })} · {r.name} · {r.error}
              </p>
            ))}
          </div>
        )}
        <h3 className="mb-2 mt-4 text-sm font-bold">מיילים שנכשלו סופית</h3>
        {failedEmails.length === 0 ? (
          <p className="text-sm text-gray-500">אין. ✓</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {failedEmails.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 p-2">
                <span className="font-medium">{e.subject}</span>
                <span className="text-xs text-gray-500" dir="ltr">
                  {e.to.join(', ')}
                </span>
                <span className="text-xs text-gray-500">
                  {e.nursery?.name ?? ''} · {e.attempts} ניסיונות · {e.lastError}
                </span>
                <form action={retryEmailAction} className="ms-auto">
                  <input type="hidden" name="id" value={e.id} />
                  <button className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">שליחה חוזרת</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">שליחת מייל בדיקה</h2>
        <TestEmailForm defaultTo={user.email} />
      </section>

      <section>
        <h2 className="mb-3 font-bold">תוצאות שליחה אחרונות</h2>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            אין עדיין רשומות. הזמנות חדשות יתועדו כאן.
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((e) => {
              const m = (e.metadata ?? {}) as Record<string, unknown>;
              return (
                <div key={e.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <p className="mb-1 text-xs text-gray-400">
                    {e.createdAt.toLocaleString('he-IL')} ·{' '}
                    {e.action === 'email.test'
                      ? 'מייל בדיקה'
                      : `הזמנה ${e.entityId?.slice(0, 8)}${e.nursery ? ` · ${e.nursery.name}` : ''}`}
                  </p>
                  {e.action === 'email.test' ? (
                    <Outcome label="בדיקה" r={m as SendOutcome} />
                  ) : (
                    <>
                      <Outcome label="לקוח" r={m.customer as SendOutcome | undefined} />
                      <Outcome label="משתלה" r={m.owner as SendOutcome | undefined} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
