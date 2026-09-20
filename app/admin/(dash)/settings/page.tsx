import { requireUser } from '@/lib/auth';
import { isModuleEnabled } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { NurseryProfileForm } from '../nurseries/profile-form';
import { nurseryToFormValues } from '../nurseries/form-values';
import { PaymentMethodsForm } from './payment-methods-form';
import { ChannelsForm } from './channels-form';

export const dynamic = 'force-dynamic';

export default async function NurserySettingsPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);

  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);

  if (!nurseryId) {
    return <p className="text-gray-500">אין משתלה משויכת.</p>;
  }

  const nursery = await prisma.nursery.findUnique({ where: { id: nurseryId } });
  if (!nursery) return <p className="text-gray-500">המשתלה לא נמצאה.</p>;

  const canEditDesign =
    user.role === 'SUPER_ADMIN' || (await isModuleEnabled(nurseryId, 'design'));
  const salesEnabled =
    user.role === 'SUPER_ADMIN' || (await isModuleEnabled(nurseryId, 'sales'));
  const socialEnabled =
    user.role === 'SUPER_ADMIN' || (await isModuleEnabled(nurseryId, 'social'));

  const paymentMethods = salesEnabled
    ? await prisma.nurseryPaymentMethod.findMany({ where: { nurseryId } })
    : [];
  const channels = socialEnabled
    ? await prisma.nurseryChannel.findMany({ where: { nurseryId } })
    : [];

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-bold">הגדרות המשתלה</h1>
        <p className="mb-6 text-sm text-gray-500">
          פרטים אלה מוצגים בחנות: hero, יצירת קשר, מיקום, שעות פעילות ורשתות חברתיות.
        </p>

        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <NurseryProfileForm
            nursery={nurseryToFormValues(nursery)}
            scope="owner"
            canEditDesign={canEditDesign}
          />
        </div>
      </div>

      {salesEnabled && (
        <div>
          <h2 className="mb-1 text-xl font-bold">אפשרויות תשלום</h2>
          <p className="mb-4 text-sm text-gray-500">
            הגדירו כיצד לקוחות משלמים בעת הזמנה — הפרטים יוצגו בעמוד ה-checkout, והלקוח יתבקש למלא
            אסמכתא לאחר התשלום.
          </p>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <PaymentMethodsForm methods={paymentMethods} />
          </div>
        </div>
      )}

      {socialEnabled && (
        <div>
          <h2 className="mb-1 text-xl font-bold">רשתות חברתיות ויצירת קשר</h2>
          <p className="mb-4 text-sm text-gray-500">
            הפעילו ומלאו את הערוצים שברצונכם להציג בחנות (פוטר ועמוד יצירת קשר).
          </p>
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <ChannelsForm channels={channels} />
          </div>
        </div>
      )}
    </div>
  );
}
