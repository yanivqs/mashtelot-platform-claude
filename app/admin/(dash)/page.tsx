import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminOverviewPage() {
  const user = await requireUser();

  if (user.role === 'SUPER_ADMIN') {
    const [nurseries, plants, supplies, products, orders] = await Promise.all([
      prisma.nursery.count(),
      prisma.plant.count(),
      prisma.masterSupply.count(),
      prisma.nurseryProduct.count(),
      prisma.order.count(),
    ]);
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">סקירת פלטפורמה</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="משתלות" value={nurseries} href="/admin/nurseries" />
          <Stat label="צמחים בקטלוג" value={plants.toLocaleString('he-IL')} href="/admin/catalog" />
          <Stat label="פריטי ציוד" value={supplies} />
          <Stat label="מוצרים משויכים" value={products} />
          <Stat label="הזמנות" value={orders} />
        </div>
      </div>
    );
  }

  if (!user.nurseryId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        המשתמש שלך אינו משויך למשתלה. פנה למנהל המערכת.
      </div>
    );
  }

  const [total, active, outOfStock, orders] = await Promise.all([
    prisma.nurseryProduct.count({ where: { nurseryId: user.nurseryId } }),
    prisma.nurseryProduct.count({ where: { nurseryId: user.nurseryId, isActive: true } }),
    prisma.nurseryProduct.count({ where: { nurseryId: user.nurseryId, stockQuantity: { lte: 0 } } }),
    prisma.order.count({ where: { nurseryId: user.nurseryId } }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{user.nursery?.name}</h1>
      <p className="mb-6 text-sm text-gray-500">סקירת החנות שלך</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="סה״כ מוצרים" value={total} href="/admin/products" />
        <Stat label="פעילים" value={active} href="/admin/products" />
        <Stat label="אזלו מהמלאי" value={outOfStock} href="/admin/products" />
        <Stat label="הזמנות" value={orders} href="/admin/orders" />
      </div>

      <div className="mt-8 rounded-xl border border-gray-100 bg-white p-6">
        <h2 className="font-bold">פעולות מהירות</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/admin/products/browse"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            הוספת מוצרים מהקטלוג
          </Link>
          <Link
            href="/admin/products"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            עדכון מחירים ומלאי
          </Link>
        </div>
      </div>
    </div>
  );
}
