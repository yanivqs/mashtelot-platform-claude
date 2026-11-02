import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlatformContact } from '@/lib/nursery-account';
import { accountStatus, BILLING_TYPE_LABELS, formatAccountDate, PAYMENT_METHOD_LABELS } from '@/lib/nursery-billing';
import { formatPrice } from '@/lib/utils';
import { isBaseModule } from '@/lib/modules';
import { ContactForm } from './forms';
import { AccountBadge } from './badge';

export const dynamic = 'force-dynamic';

/** חשבונות משתלות: מודולים, עלויות וחיוב של כל משתלה. */
export default async function AccountsPage() {
  await requireUser(['SUPER_ADMIN']);
  const [nurseries, contact] = await Promise.all([
    prisma.nursery.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, subdomain: true, account: true, modules: { where: { isEnabled: true }, select: { moduleKey: true, monthlyFee: true } } },
    }),
    getPlatformContact(),
  ]);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">חשבונות משתלות</h1>
        <p className="mt-1 text-sm text-gray-600">לכל משתלה: המודולים שלה, עלות הקמה ועלות חודשית, מועד חיוב וצורת תשלום.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">משתלה</th>
              <th className="px-4 py-2 font-medium">מצב</th>
              <th className="px-4 py-2 font-medium">הצטרפות</th>
              <th className="px-4 py-2 font-medium">תאריך חיוב</th>
              <th className="px-4 py-2 font-medium">לתשלום</th>
              <th className="px-4 py-2 font-medium">חיוב</th>
              <th className="px-4 py-2 font-medium">תוספות</th>
              <th className="px-4 py-2 font-medium">חודשי לפי מודולים</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {nurseries.map((n) => {
              const a = n.account;
              const addons = n.modules.filter((m) => !isBaseModule(m.moduleKey) && m.moduleKey !== 'promotions');
              const monthly = Number(a?.baseMonthlyFee ?? 0) + addons.reduce((s, m) => s + Number(m.monthlyFee), 0);
              return (
                <tr key={n.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/accounts/${n.id}`} className="font-medium text-brand-800 underline">
                      {n.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <AccountBadge status={accountStatus(a)} />
                  </td>
                  <td className="px-4 py-2.5">{formatAccountDate(a?.joinedAt)}</td>
                  <td className="px-4 py-2.5">{a?.billingType === 'ONE_TIME' && a.validUntil ? `בתוקף עד ${formatAccountDate(a.validUntil)}` : formatAccountDate(a?.billingDate)}</td>
                  <td className="px-4 py-2.5">{a?.amountDue ? formatPrice(a.amountDue.toString()) : '—'}</td>
                  <td className="px-4 py-2.5">
                    {a?.billingType ? BILLING_TYPE_LABELS[a.billingType] : '—'}
                    {a?.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[a.paymentMethod]}` : ''}
                  </td>
                  <td className="px-4 py-2.5">{addons.length}</td>
                  <td className="px-4 py-2.5">{formatPrice(monthly)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-bold">פרטי קשר למשתלה חסומה</h2>
        <p className="mb-3 mt-1 text-sm text-gray-600">מוצגים למנהל משתלה שהגישה שלו הוגבלה.</p>
        <ContactForm name={contact.name ?? ''} phone={contact.phone ?? ''} email={contact.email} />
      </section>
    </div>
  );
}
