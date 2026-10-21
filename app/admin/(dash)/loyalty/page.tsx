import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { LoyaltySettingsForm } from './form';

export const dynamic = 'force-dynamic';

/** מועדון לקוחות (R06-06): הגדרות צבירה ומימוש. מוצג רק כשהסופר-אדמין הפעיל את המודול למשתלה. */
export default async function LoyaltyPage() {
  const { nurseryId } = await requireNurseryPage({ all: ['loyalty'] });
  const [s, stats] = await Promise.all([
    prisma.loyaltySettings.findUnique({ where: { nurseryId } }),
    prisma.loyaltyEntry.aggregate({ where: { nurseryId }, _sum: { points: true }, _count: { customerId: true } }),
  ]);
  const value = s
    ? { pointsPerShekel: Number(s.pointsPerShekel), pointValue: Number(s.pointValue), maxRedeemPct: s.maxRedeemPct }
    : { pointsPerShekel: 1, pointValue: 0, maxRedeemPct: 50 };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">מועדון לקוחות</h1>
        <p className="mt-1 text-sm text-gray-500">
          לקוחות רשומים צוברים נקודות על הזמנות שנמסרו, ומממשים אותן בקופה. ביטול הזמנה מבטל את הצבירה ומחזיר נקודות שמומשו. כל תנועה נרשמת ביומן
          הנקודות (בכרטיס הלקוח).
        </p>
      </div>
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <LoyaltySettingsForm value={value} />
      </section>
      <p className="text-sm text-gray-600" data-testid="loyalty-stats">
        נקודות פתוחות אצל לקוחות: {stats._sum.points ?? 0}
      </p>
    </div>
  );
}
