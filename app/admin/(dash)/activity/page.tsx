import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'medium' });

/** תחומי פעולות לסינון (לפי קידומת שם הפעולה). */
const GROUPS: Array<{ key: string; label: string; prefixes: string[] }> = [
  { key: 'catalog', label: 'מוצרים ומלאי', prefixes: ['product', 'variant', 'stock', 'catalog'] },
  { key: 'orders', label: 'הזמנות ותשלומים', prefixes: ['order', 'payment'] },
  { key: 'marketing', label: 'קופונים ומבצעים', prefixes: ['coupon', 'promotion'] },
  { key: 'content', label: 'עמודים ובלוג', prefixes: ['page', 'blog'] },
  { key: 'settings', label: 'הגדרות', prefixes: ['nursery', 'payment_methods', 'channels', 'delivery_settings', 'shipping'] },
  { key: 'team', label: 'צוות וחשבונות', prefixes: ['team', 'auth'] },
  { key: 'customers', label: 'לקוחות ופרטיות', prefixes: ['customer', 'crm', 'loyalty', 'privacy'] },
  { key: 'print', label: 'בית דפוס', prefixes: ['print'] },
];

/**
 * יומן פעולות (§20.02, §20.05): סופר-אדמין — כל הפלטפורמה, עם סינון לפי משתלה;
 * בעל משתלה — רק המשתלה שלו (למשל מה עשו העובדים). עובדים וכותבי תוכן — אין גישה.
 */
export default async function ActivityPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const isSuper = user.role === 'SUPER_ADMIN';
  const nurseryScope = isSuper ? null : (await requireNurseryPage({ area: 'owner' })).nurseryId;
  const sp = await props.searchParams;
  const group = GROUPS.find((g) => g.key === sp.group) ?? null;
  const q = sp.q?.trim().toLowerCase().slice(0, 254) || '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const nurseryFilter = isSuper ? sp.nursery || null : nurseryScope;

  const where: Prisma.AuditEventWhereInput = {
    ...(nurseryFilter ? { nurseryId: nurseryFilter } : {}),
    ...(group ? { OR: group.prefixes.map((p) => ({ action: { startsWith: `${p}.` } })) } : {}),
    ...(q ? { actorEmail: { contains: q } } : {}),
  };
  const [events, total, nurseries] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      include: { nursery: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditEvent.count({ where }),
    isSuper ? prisma.nursery.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ]);

  const params = Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== 'page' && v)) as Record<string, string>;
  const href = (p: number) => `/admin/activity?${new URLSearchParams({ ...params, ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;
  const field = 'rounded-lg border border-gray-200 px-3 py-2 text-sm';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">יומן פעולות</h1>
        <p className="text-sm text-gray-500">
          {isSuper ? 'פעולות רגישות בכל הפלטפורמה.' : 'פעולות שבוצעו במשתלה שלך — שלך ושל הצוות.'} {total} רשומות.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <select name="group" defaultValue={sp.group ?? ''} aria-label="תחום" className={field}>
          <option value="">כל התחומים</option>
          {GROUPS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
        {isSuper && (
          <select name="nursery" defaultValue={sp.nursery ?? ''} aria-label="משתלה" className={field}>
            <option value="">כל המשתלות</option>
            {nurseries.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        )}
        <input name="q" defaultValue={sp.q} placeholder="מבצע (אימייל)" aria-label="מבצע" className={field} />
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">סינון</button>
        <Link href="/admin/activity" className="text-sm text-gray-500 hover:underline">
          ניקוי
        </Link>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2">מתי</th>
              <th className="px-3 py-2">פעולה</th>
              <th className="px-3 py-2">מבצע</th>
              {isSuper && <th className="px-3 py-2">משתלה</th>}
              <th className="px-3 py-2">פרטים</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((e) => (
              <tr key={e.id} data-testid="activity-row">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{dateFmt.format(e.createdAt)}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-3 py-2 text-xs" dir="ltr">
                  {e.actorEmail ?? '—'}
                </td>
                {isSuper && <td className="px-3 py-2 text-xs">{e.nursery?.name ?? '—'}</td>}
                <td className="max-w-md truncate px-3 py-2 font-mono text-[11px] text-gray-500" title={e.metadata ? JSON.stringify(e.metadata) : ''}>
                  {e.metadata ? JSON.stringify(e.metadata) : ''}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  אין פעולות בסינון הזה.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={href} />
    </div>
  );
}
