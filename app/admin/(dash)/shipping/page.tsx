import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { ZoneForm } from './forms';
import { toggleZone, deleteZone } from './actions';

export const dynamic = 'force-dynamic';

export default async function ShippingPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireModule('shipping');
  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);

  if (!nurseryId) return <p className="text-gray-500">אין משתלה משויכת.</p>;

  const zones = await prisma.shippingZone.findMany({
    where: { nurseryId },
    include: { cities: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">אזורי משלוח</h1>
        <p className="text-sm text-gray-500">
          הגדירו עלות משלוח לפי עיר, עם אפשרות לסף למשלוח חינם. משתלה ללא אזורים מוגדרים לא תציג
          שלב משלוח ב-checkout.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <ZoneForm />
      </div>

      {zones.length > 0 && (
        <div className="space-y-3">
          {zones.map((z) => (
            <div key={z.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-gray-900">{z.name}</span>
                <span className="text-sm text-gray-500">{formatPrice(z.shippingPrice.toString())}</span>
                {z.freeShippingThreshold !== null && (
                  <span className="text-xs text-gray-400">
                    חינם מעל {formatPrice(z.freeShippingThreshold.toString())}
                  </span>
                )}
                <span
                  className={`ms-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                    z.isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {z.isEnabled ? 'פעיל' : 'כבוי'}
                </span>
                <form action={toggleZone}>
                  <input type="hidden" name="id" value={z.id} />
                  <button className="text-xs text-gray-500 hover:text-gray-800">
                    {z.isEnabled ? 'כבה' : 'הפעל'}
                  </button>
                </form>
                <form action={deleteZone}>
                  <input type="hidden" name="id" value={z.id} />
                  <button className="text-xs text-red-600 hover:text-red-800">מחק</button>
                </form>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {z.cities.map((c) => c.cityName).join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
