import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { getCustomer } from '@/lib/customer-session';
import { LoginForm, ProfileForm } from './forms';
import { logoutAction } from './actions';

// מידע אישי — לעולם לא במטמון, לא באינדקס
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'החשבון שלי',
  robots: { index: false, follow: false },
};

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

  const orders = await prisma.order.count({ where: { nurseryId: nursery.id, customerId: customer.id } });

  return (
    <div dir="rtl" className="mx-auto max-w-2xl space-y-6 px-6 py-10">
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

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-bold">ההזמנות שלי</h2>
        <p className="text-sm text-gray-600" data-testid="order-count">
          {orders ? `${orders} הזמנות משויכות לחשבון.` : 'עדיין אין הזמנות בחשבון.'}
        </p>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
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
