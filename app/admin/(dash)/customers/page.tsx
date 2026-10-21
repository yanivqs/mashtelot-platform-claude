import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { CRM_PAGE_SIZE, listCustomers, parseCrmFilter } from '@/lib/crm';
import { formatPrice } from '@/lib/utils';
import { Pagination } from '@/components/pagination';
import { DeleteGroupButton, ExportButton, GroupDiscountForm, GroupForm } from './forms';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short' });
const field = 'rounded-lg border border-gray-200 px-3 py-2 text-sm';

/** CRM (R06-05/07/08): לקוחות רשומים ואורחים, סינון, קבוצות ויצוא. */
export default async function CustomersPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { nurseryId } = await requireNurseryPage({ all: ['crm'] });
  const sp = await props.searchParams;
  const filter = parseCrmFilter(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total }, groups] = await Promise.all([
    listCustomers(prisma, nurseryId, filter, page),
    prisma.customerGroup.findMany({ where: { nurseryId }, orderBy: { name: 'asc' } }),
  ]);
  const params = Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== 'page' && typeof v === 'string' && v)) as Record<string, string>;
  const qs = (p: number) => `/admin/customers?${new URLSearchParams({ ...params, ...(p > 1 ? { page: String(p) } : {}) }).toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">לקוחות</h1>
          <p className="text-sm text-gray-500">לקוחות רשומים ואורחים מההזמנות, לפי אימייל. {total} לקוחות בסינון הנוכחי.</p>
        </div>
        <ExportButton params={params} />
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <input name="q" defaultValue={sp.q} placeholder="שם / אימייל / טלפון / חברה" aria-label="חיפוש" className={`${field} min-w-56 flex-1`} />
        <input name="tag" defaultValue={sp.tag} placeholder="תגית" aria-label="תגית" className={`${field} w-28`} />
        <select name="group" defaultValue={sp.group ?? ''} aria-label="קבוצה" className={field}>
          <option value="">כל הקבוצות</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={sp.type ?? ''} aria-label="סוג" className={field}>
          <option value="">פרטי + עסקי</option>
          <option value="PRIVATE">פרטי</option>
          <option value="BUSINESS">עסקי</option>
        </select>
        <input name="minSpent" type="number" min="0" defaultValue={sp.minSpent} placeholder="רכישות מעל ₪" aria-label="רכישות מעל" className={`${field} w-32`} />
        <select name="activeDays" defaultValue={sp.activeDays ?? ''} aria-label="הזמנה אחרונה" className={field}>
          <option value="">כל הזמנים</option>
          <option value="30">הזמינו ב-30 יום</option>
          <option value="90">הזמינו ב-90 יום</option>
          <option value="365">הזמינו בשנה</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="consent" value="1" defaultChecked={sp.consent === '1'} /> הסכימו לדיוור
        </label>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">סינון</button>
        <Link href="/admin/customers" className="text-sm text-gray-500 hover:underline">
          ניקוי
        </Link>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2">לקוח</th>
              <th className="px-3 py-2">טלפון</th>
              <th className="px-3 py-2">הזמנות</th>
              <th className="px-3 py-2">רכישות</th>
              <th className="px-3 py-2">אחרונה</th>
              <th className="px-3 py-2">קבוצה / תגיות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.email} data-testid="crm-row">
                <td className="px-3 py-2">
                  <Link href={`/admin/customers/view?email=${encodeURIComponent(r.email)}`} className="font-medium text-brand-700 hover:underline">
                    {r.companyName || r.name || r.email}
                  </Link>
                  <div className="text-xs text-gray-500" dir="ltr">
                    {r.email}
                  </div>
                  <div className="mt-0.5 flex gap-1 text-[11px]">
                    {r.registered && <span className="rounded bg-sky-50 px-1.5 text-sky-700">רשום</span>}
                    {r.type === 'BUSINESS' && <span className="rounded bg-amber-50 px-1.5 text-amber-800">עסקי</span>}
                    {r.marketingConsentAt && <span className="rounded bg-green-50 px-1.5 text-green-700">דיוור</span>}
                  </div>
                </td>
                <td className="px-3 py-2" dir="ltr">
                  {r.phone}
                </td>
                <td className="px-3 py-2">{r.orders}</td>
                <td className="px-3 py-2">{formatPrice(r.spent)}</td>
                <td className="px-3 py-2">{r.lastOrderAt ? dateFmt.format(r.lastOrderAt) : '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {r.groupName && <span className="me-1 rounded bg-gray-100 px-1.5 py-0.5">{r.groupName}</span>}
                  {r.tags.join(', ')}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  אין לקוחות בסינון הזה.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / CRM_PAGE_SIZE))} hrefFor={qs} />

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-bold">קבוצות לקוחות</h2>
        <p className="mb-3 text-xs text-gray-500">הנחת קבוצה (0–50%) חלה על כל הקטלוג, בהזמנות של לקוחות מחוברים בקבוצה, לפני הקופון.</p>
        <ul className="mb-3 flex flex-wrap gap-2 text-sm">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-3 rounded-full border border-gray-200 px-3 py-1">
              {g.name} <GroupDiscountForm id={g.id} name={g.name} discountPct={Number(g.discountPct)} /> <DeleteGroupButton id={g.id} name={g.name} />
            </li>
          ))}
          {groups.length === 0 && <li className="text-gray-500">אין קבוצות עדיין.</li>}
        </ul>
        <GroupForm />
      </section>
    </div>
  );
}
