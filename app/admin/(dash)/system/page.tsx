import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailConfigStatus } from '@/lib/email';
import { TestEmailForm } from './test-email-form';

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
