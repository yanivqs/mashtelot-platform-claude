import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { parseAccessibilityInfo, reportDaysLeft, REPORTS_PER_PAGE, REPORT_STATUS_LABELS } from '@/lib/accessibility';
import { runAccessibilityAudit } from '@/lib/accessibility-audit';
import { AccessibilityInfoForm, ReportControls } from './forms';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: 'Asia/Jerusalem' });

function deadline(daysLeft: number): string {
  if (daysLeft < 0) return `עברו ${Math.abs(daysLeft)} ימים מהמועד`;
  if (daysLeft === 0) return 'המועד הוא היום';
  return `נותרו ${daysLeft} ימים`;
}

export default async function AccessibilityAdminPage() {
  const { nurseryId } = await requireNurseryPage();
  const [nursery, reports, findings] = await Promise.all([
    prisma.nursery.findUniqueOrThrow({ where: { id: nurseryId }, select: { accessibilityInfo: true } }),
    prisma.accessibilityReport.findMany({ where: { nurseryId }, orderBy: [{ resolvedAt: { sort: 'desc', nulls: 'first' } }, { dueAt: 'asc' }], take: REPORTS_PER_PAGE }),
    runAccessibilityAudit(prisma, nurseryId),
  ]);
  const info = parseAccessibilityInfo(nursery.accessibilityInfo);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">נגישות</h1>
        <p className="mt-1 text-sm text-gray-500">
          בחנות שלכם פועל תפריט נגישות, ויש בה הצהרת נגישות וטופס דיווח. כאן מנהלים את הפרטים, הפניות והתוכן שבאחריותכם.
        </p>
      </div>

      <section aria-labelledby="audit-title" className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 id="audit-title" className="text-lg font-bold">
          בדיקת התוכן שלכם
        </h2>
        {findings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-700" data-testid="a11y-audit-clean">
            לא נמצאו בעיות בבדיקה האוטומטית.
          </p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="a11y-findings">
            {findings.map((f) => (
              <li key={f.id} data-finding={f.id} className={`rounded-lg border p-3 text-sm ${f.level === 'fix' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                <p className="font-semibold text-gray-900">
                  {f.level === 'fix' ? 'לתיקון: ' : 'לבדיקה: '}
                  {f.title}
                </p>
                <p className="mt-0.5 text-gray-700">{f.detail}</p>
                {f.href && (
                  <Link href={f.href} className="mt-1 inline-block font-medium text-brand-800 underline">
                    מעבר לתיקון
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-600">
          הבדיקה אוטומטית ובודקת רק חלק מהתקן. לפי נציבות שוויון זכויות, רוב הבדיקה נעשית בידי אנשים. תפריט נגישות לא פוטר מעמידה בתקן 5568, ולכן בדיקה בידי מומחה נשארת
          הדרך לדעת שהאתר עומד בו.
        </p>
      </section>

      <section aria-labelledby="reports-title" className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 id="reports-title" className="text-lg font-bold">
          פניות על בעיות נגישות
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          לפי התקנות יש לתקן בתוך 60 ימים מיום ההודעה, ובינתיים לתת התאמה חלופית בהקדם, למשל שירות בטלפון.
        </p>
        {reports.length === 0 ? (
          <p className="mt-3 rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">עדיין אין פניות.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.map((r) => {
              const left = reportDaysLeft(r.dueAt);
              const open = r.status !== 'RESOLVED';
              return (
                <li key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm" data-testid="a11y-report">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {REPORT_STATUS_LABELS[r.status]} · התקבלה ב-{dateFmt.format(r.createdAt)}
                    </span>
                    {open && (
                      <span className={left < 0 ? 'font-semibold text-red-700' : 'text-gray-600'} data-testid="a11y-report-deadline">
                        {deadline(left)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-gray-800">{r.description}</p>
                  {r.pageUrl && <p className="mt-1 text-gray-600">עמוד: {r.pageUrl}</p>}
                  <p className="mt-1 text-gray-600">{[r.contactName, r.contactEmail, r.contactPhone].filter(Boolean).join(' · ')}</p>
                  <ReportControls key={`${r.id}:${r.status}`} id={r.id} status={r.status} note={r.handlingNote} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="statement-title" className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 id="statement-title" className="text-lg font-bold">
          פרטי הצהרת הנגישות
        </h2>
        <p className="mb-4 mt-1 text-sm text-gray-500">הפרטים מופיעים בהצהרה שבעמוד /accessibility בחנות.</p>
        <AccessibilityInfoForm info={info} />
      </section>
    </div>
  );
}
