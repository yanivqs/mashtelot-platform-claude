import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { getCrmRow } from '@/lib/crm';
import { ORDER_STATUS_LABELS } from '@/lib/order-state';
import { formatPrice } from '@/lib/utils';
import { CustomerCrmForm, NoteForm } from '../forms';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
const card = 'rounded-xl border border-gray-100 bg-white p-5 shadow-sm';

/** כרטיס לקוח (R06-05): פרטים, הזמנות, תגיות/קבוצה/סוג, הערות פנימיות. */
export default async function CustomerViewPage(props: { searchParams: Promise<{ email?: string }> }) {
  const { nurseryId } = await requireNurseryPage({ all: ['crm'] });
  const email = String((await props.searchParams).email ?? '').toLowerCase();
  const row = email ? await getCrmRow(prisma, nurseryId, email) : null;
  if (!row) notFound();

  const [orders, groups, customer] = await Promise.all([
    prisma.order.findMany({
      where: { nurseryId, customerEmail: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, createdAt: true, status: true, totalAmount: true },
    }),
    prisma.customerGroup.findMany({ where: { nurseryId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.customer.findUnique({
      where: { nurseryId_email: { nurseryId, email } },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/customers" className="text-sm text-gray-500 hover:underline">
        ← כל הלקוחות
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{row.companyName || row.name || row.email}</h1>
        <p className="text-sm text-gray-500" dir="ltr">
          {row.email} {row.phone ? `· ${row.phone}` : ''}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {row.registered ? 'לקוח רשום' : 'אורח (ללא חשבון)'} · {row.orders} הזמנות · {formatPrice(row.spent)} ·{' '}
          {row.marketingConsentAt ? `הסכים לדיוור ב-${dateFmt.format(row.marketingConsentAt)}` : 'לא הסכים לדיוור'}
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-bold">ניהול לקוח</h2>
        <CustomerCrmForm
          email={row.email}
          groups={groups}
          value={{ tags: row.tags, groupId: row.groupId, type: row.type, companyName: row.companyName, taxId: customer?.taxId ?? null }}
        />
      </section>

      <section className={card}>
        <h2 className="mb-3 font-bold">הערות פנימיות</h2>
        <NoteForm email={row.email} />
        <ul className="mt-4 space-y-2 text-sm" data-testid="notes">
          {customer?.notes.map((n) => (
            <li key={n.id} className="rounded-lg bg-gray-50 p-2.5">
              <p className="whitespace-pre-line">{n.body}</p>
              <p className="mt-1 text-xs text-gray-500">
                {dateFmt.format(n.createdAt)} · {n.authorEmail ?? '—'}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-bold">הזמנות</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap gap-3 py-2">
              <span className="font-mono text-xs text-gray-500">#{o.id.slice(0, 8)}</span>
              <span>{dateFmt.format(o.createdAt)}</span>
              <span className="rounded-full bg-gray-100 px-2 text-xs">{ORDER_STATUS_LABELS[o.status]}</span>
              <span className="ms-auto">{formatPrice(o.totalAmount.toString())}</span>
            </li>
          ))}
          {orders.length === 0 && <li className="text-gray-500">אין הזמנות.</li>}
        </ul>
      </section>
    </div>
  );
}
