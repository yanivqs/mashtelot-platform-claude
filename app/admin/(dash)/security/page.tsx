import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LOGIN_ACTIONS, LOGIN_ACTION_VALUES, type LoginAction } from '@/lib/login';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<LoginAction, { label: string; className: string }> = {
  [LOGIN_ACTIONS.success]: { label: 'התחברות', className: 'bg-green-50 text-green-700' },
  [LOGIN_ACTIONS.failed]: { label: 'ניסיון כושל', className: 'bg-red-50 text-red-700' },
  [LOGIN_ACTIONS.blocked]: { label: 'נחסם (יותר מדי ניסיונות)', className: 'bg-amber-50 text-amber-800' },
  [LOGIN_ACTIONS.logout]: { label: 'התנתקות', className: 'bg-gray-100 text-gray-700' },
  [LOGIN_ACTIONS.sessionsRevoked]: { label: 'ניתוק כל המכשירים', className: 'bg-blue-50 text-blue-700' },
};

const REASON_LABELS: Record<string, string> = {
  unknown_email: 'אימייל לא קיים',
  bad_password: 'סיסמה שגויה',
  portal_denied: 'אין הרשאה / משתלה מושעית',
  rate_limit_ip: 'לפי IP',
  rate_limit_email: 'לפי אימייל',
};

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  timeZone: 'Asia/Jerusalem',
  dateStyle: 'short',
  timeStyle: 'medium',
});

const chip = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700'}`;

export default async function SecurityLogPage(props: {
  searchParams: Promise<{ action?: string; q?: string; page?: string }>;
}) {
  await requireUser(['SUPER_ADMIN']);
  const sp = await props.searchParams;
  const action = LOGIN_ACTION_VALUES.includes(sp.action as LoginAction) ? (sp.action as LoginAction) : null;
  const q = sp.q?.trim().toLowerCase().slice(0, 254) || '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: Prisma.AuditEventWhereInput = {
    action: action ? action : { in: [...LOGIN_ACTION_VALUES, 'auth.password_changed'] },
    ...(q ? { actorEmail: { contains: q } } : {}),
  };
  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: { nursery: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  const href = (p: number, a: string | null = action) => {
    const s = new URLSearchParams();
    if (a) s.set('action', a);
    if (q) s.set('q', q);
    if (p > 1) s.set('page', String(p));
    const str = s.toString();
    return str ? `/admin/security?${str}` : '/admin/security';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">יומן התחברויות</h1>
        <p className="text-sm text-gray-500">
          התחברויות, ניסיונות כושלים, חסימות והתנתקויות לפורטל הניהול. הסיסמה לעולם אינה נשמרת.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href(1, null)} className={chip(!action)}>
          הכל
        </Link>
        {LOGIN_ACTION_VALUES.map((a) => (
          <Link key={a} href={href(1, a)} className={chip(action === a)}>
            {ACTION_LABELS[a].label}
          </Link>
        ))}
      </div>

      <form method="get" className="flex max-w-lg gap-3">
        {action && <input type="hidden" name="action" value={action} />}
        <input
          name="q"
          defaultValue={q}
          dir="ltr"
          placeholder="סינון לפי אימייל..."
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">סינון</button>
      </form>

      <p className="text-xs text-gray-500">{total} רשומות</p>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          אין רשומות.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-right text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">מתי</th>
                <th className="px-3 py-2 font-medium">אירוע</th>
                <th className="px-3 py-2 font-medium">אימייל</th>
                <th className="px-3 py-2 font-medium">משתלה</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">דפדפן</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => {
                const m = (e.metadata ?? {}) as { ip?: string; userAgent?: string | null; reason?: string };
                const meta = ACTION_LABELS[e.action as LoginAction] ?? {
                  label: e.action === 'auth.password_changed' ? 'החלפת סיסמה' : e.action,
                  className: 'bg-purple-50 text-purple-700',
                };
                return (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">{dateFmt.format(e.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                      {m.reason && (
                        <span className="mr-2 text-xs text-gray-500">{REASON_LABELS[m.reason] ?? m.reason}</span>
                      )}
                    </td>
                    <td className="px-3 py-2" dir="ltr">
                      {e.actorEmail ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{e.nursery?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs" dir="ltr">
                      {m.ip ?? '—'}
                    </td>
                    <td
                      className="max-w-xs truncate px-3 py-2 text-xs text-gray-400"
                      dir="ltr"
                      title={m.userAgent ?? undefined}
                    >
                      {m.userAgent ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={(p) => href(p)} />
    </div>
  );
}
