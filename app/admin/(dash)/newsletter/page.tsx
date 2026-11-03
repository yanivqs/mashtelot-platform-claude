import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { SUBSCRIBERS_PER_PAGE } from '@/lib/newsletter';
import { ExportSubscribers, RemoveSubscriber } from './forms';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: 'Asia/Jerusalem' });

export default async function NewsletterPage(props: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { nurseryId } = await requireNurseryPage({ all: ['newsletter'] });
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? '').trim().slice(0, 100);
  const page = Math.max(1, Number(searchParams.page) || 1);
  const where = { nurseryId, ...(q ? { email: { contains: q, mode: 'insensitive' as const } } : {}) };
  const [rows, total, active] = await Promise.all([
    prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * SUBSCRIBERS_PER_PAGE, take: SUBSCRIBERS_PER_PAGE }),
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.count({ where: { nurseryId, unsubscribedAt: null } }),
  ]);
  const pageHref = (p: number) => `/admin/newsletter?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">תפוצת דואר</h1>
      <p className="mt-1 text-sm text-gray-500">
        לקוחות נרשמים מהטופס שבתחתית החנות. המערכת אוספת את הכתובות, והשליחה עצמה נעשית מכלי דיוור חיצוני לפי קובץ היצוא. מי שביקש הסרה צריך להיות מוסר גם כאן.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium" data-testid="newsletter-active">
          רשומים כרגע: {active.toLocaleString('he-IL')}
        </p>
        <ExportSubscribers />
      </div>
      <form className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="חיפוש כתובת"
          placeholder="חיפוש כתובת..."
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
      </form>
      {rows.length === 0 ? (
        <p className="mt-4 rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500">{q ? 'לא נמצאו כתובות.' : 'עדיין אין נרשמים.'}</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" data-testid="newsletter-row">
              <span dir="ltr" className="min-w-0 break-all font-medium">
                {r.email}
              </span>
              <span className="flex items-center gap-3 text-xs text-gray-600">
                <span>הסכמה: {dateFmt.format(r.consentAt)}</span>
                {r.unsubscribedAt ? <span>הוסר ב-{dateFmt.format(r.unsubscribedAt)}</span> : <RemoveSubscriber id={r.id} email={r.email} />}
              </span>
            </li>
          ))}
        </ul>
      )}
      {total > SUBSCRIBERS_PER_PAGE && (
        <nav aria-label="עמודים" className="mt-4 flex items-center gap-4 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="text-brand-700 underline">הקודם</Link>}
          <span className="text-gray-600">עמוד {page} מתוך {Math.ceil(total / SUBSCRIBERS_PER_PAGE)}</span>
          {page * SUBSCRIBERS_PER_PAGE < total && <Link href={pageHref(page + 1)} className="text-brand-700 underline">הבא</Link>}
        </nav>
      )}
    </div>
  );
}
