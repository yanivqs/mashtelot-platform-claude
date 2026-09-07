import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { CouponForm, PromotionForm } from './forms';
import { toggleCoupon, deleteCoupon, togglePromotion, deletePromotion } from './actions';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireModule('promotions');
  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);

  if (!nurseryId) return <p className="text-gray-500">אין משתלה משויכת.</p>;

  const [coupons, promotions] = await Promise.all([
    prisma.coupon.findMany({ where: { nurseryId }, orderBy: { createdAt: 'desc' } }),
    prisma.promotion.findMany({ where: { nurseryId }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">שיווק</h1>
        <p className="text-sm text-gray-500">קופונים ופופאפים לחנות שלך</p>
      </div>

      <section>
        <h2 className="mb-3 font-bold text-gray-900">קופונים</h2>
        <div className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <CouponForm />
        </div>
        {coupons.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {coupons.map((c) => (
              <div key={c.id} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0">
                <span className="font-mono text-sm font-medium text-gray-900">{c.code}</span>
                <span className="text-sm text-gray-500">{Number(c.discountPct)}% הנחה</span>
                <span
                  className={`ms-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {c.isActive ? 'פעיל' : 'כבוי'}
                </span>
                <form action={toggleCoupon}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-gray-500 hover:text-gray-800">
                    {c.isActive ? 'כבה' : 'הפעל'}
                  </button>
                </form>
                <form action={deleteCoupon}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-red-600 hover:text-red-800">מחק</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-bold text-gray-900">פופאפים</h2>
        <div className="mb-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <PromotionForm />
        </div>
        {promotions.length > 0 && (
          <div className="space-y-2">
            {promotions.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{p.title}</span>
                  <span
                    className={`ms-auto rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {p.isActive ? 'מוצג' : 'כבוי'}
                  </span>
                  <form action={togglePromotion}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-xs text-gray-500 hover:text-gray-800">
                      {p.isActive ? 'כבה' : 'הפעל'}
                    </button>
                  </form>
                  <form action={deletePromotion}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-xs text-red-600 hover:text-red-800">מחק</button>
                  </form>
                </div>
                <p className="mt-2 text-sm text-gray-600">{p.popupText}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-400">
          פופאפ פעיל אחד (החדש ביותר) יוצג למבקרים בחנות, פעם אחת לכל מבקר.
        </p>
      </section>
    </div>
  );
}
