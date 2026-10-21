import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { getCustomer } from '@/lib/customer-session';
import { customerAddresses, customerOrders } from '@/lib/customer-portal';
import { ORDER_STATUS_LABELS } from '@/lib/order-state';
import { formatPrice } from '@/lib/utils';
import { LoginForm, ProfileForm } from './forms';
import { logoutAction } from './actions';
import { addressOpAction, productSummaries } from './portal-actions';
import { AddAddressForm, ProductGrid, RecentProducts } from './portal-ui';

// מידע אישי — לעולם לא במטמון, לא באינדקס
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'החשבון שלי',
  robots: { index: false, follow: false },
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'medium' });
const card = 'rounded-xl border border-gray-100 bg-white p-5 shadow-sm';

export default async function AccountPage(props: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await props.params;
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery || !(await isModuleEnabled(nursery.id, 'customer_accounts'))) notFound();
  const customer = await getCustomer(nursery.id);

  if (!customer) {
    return (
      <div dir="rtl" className="mx-auto max-w-md px-6 py-14">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">כניסה לחשבון</h1>
        <p className="mb-6 text-sm text-gray-500">
          נשלח לכם קוד חד-פעמי במייל — בלי סיסמה. אין לכם חשבון? הוא ייפתח אוטומטית בכניסה הראשונה, וההזמנות הקודמות שלכם עם אותו מייל יופיעו בו.
        </p>
        <LoginForm tenant={tenant} />
      </div>
    );
  }

  const [orders, addresses, favoriteRows] = await Promise.all([
    customerOrders(prisma, nursery.id, customer.id),
    customerAddresses(prisma, customer.id),
    prisma.customerFavorite.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, take: 12, select: { nurseryProductId: true } }),
  ]);
  const favorites = await productSummaries(tenant, favoriteRows.map((f) => f.nurseryProductId));

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">החשבון שלי</h1>
          <p className="text-sm text-gray-500" dir="ltr">
            {customer.email}
          </p>
        </div>
        <form action={logoutAction}>
          <input type="hidden" name="tenant" value={tenant} />
          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">יציאה</button>
        </form>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-bold">ההזמנות שלי</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-600" data-testid="order-count">
            עדיין אין הזמנות בחשבון.
          </p>
        ) : (
          <>
            <p className="sr-only" data-testid="order-count">
              {orders.length} הזמנות משויכות לחשבון.
            </p>
            <ul className="divide-y divide-gray-100 text-sm" data-testid="orders">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-gray-50">
                    <span className="font-mono text-xs text-gray-500">#{o.id.slice(0, 8)}</span>
                    <span>{dateFmt.format(o.createdAt)}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{ORDER_STATUS_LABELS[o.status]}</span>
                    <span className="ms-auto font-medium">{formatPrice(o.totalAmount.toString())}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-bold">מועדפים</h2>
        <ProductGrid items={favorites} empty="עוד אין מועדפים. לחצו על ♡ בדף מוצר כדי לשמור." />
      </section>

      <section className={card}>
        <h2 className="mb-3 font-bold">נצפו לאחרונה</h2>
        <RecentProducts tenant={tenant} />
      </section>

      <section className={card}>
        <h2 className="mb-3 font-bold">כתובות למשלוח</h2>
        {addresses.length > 0 && (
          <ul className="mb-4 space-y-2 text-sm" data-testid="addresses">
            {addresses.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 p-2.5">
                {a.label && <span className="font-medium">{a.label}:</span>}
                <span>
                  {a.street}, {a.city}
                  {a.postcode ? ` ${a.postcode}` : ''}
                </span>
                {a.isDefault && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">ברירת מחדל</span>}
                <span className="ms-auto flex gap-3">
                  {!a.isDefault && (
                    <form action={addressOpAction}>
                      <input type="hidden" name="tenant" value={tenant} />
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="op" value="default" />
                      <button className="text-xs text-gray-600 hover:underline">קביעה כברירת מחדל</button>
                    </form>
                  )}
                  <form action={addressOpAction}>
                    <input type="hidden" name="tenant" value={tenant} />
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="op" value="delete" />
                    <button className="text-xs text-rose-700 hover:underline">מחיקה</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <AddAddressForm tenant={tenant} />
      </section>

      <section className={card}>
        <h2 className="mb-4 font-bold">פרטים אישיים</h2>
        <ProfileForm
          tenant={tenant}
          profile={{ fullName: customer.fullName ?? '', phone: customer.phone ?? '', consent: Boolean(customer.marketingConsentAt) }}
          nurseryName={nursery.name}
        />
      </section>

      <form action={logoutAction} className="text-center">
        <input type="hidden" name="tenant" value={tenant} />
        <input type="hidden" name="all" value="1" />
        <button className="text-xs text-gray-500 hover:underline">יציאה מכל המכשירים</button>
      </form>
    </div>
  );
}
