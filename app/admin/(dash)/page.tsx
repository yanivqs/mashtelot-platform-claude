import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { scoreProductSeo } from '@/lib/seo-score';
import { denialMessage } from '@/lib/nursery-scope';
import { lineTitle } from '@/lib/variants';
import { catalogRevisionInclude, localizeProduct } from '@/lib/catalog-localize';
import { pendingUpdateCount } from '@/lib/catalog-sync-admin';
import { getEnabledModuleKeys } from '@/lib/module-access';

/** §8.04: סף מלאי נמוך לווריאנט (ברירת מחדל) */
const LOW_STOCK_THRESHOLD = 5;

function Notice({ reason }: { reason?: string }) {
  const message = denialMessage(reason);
  if (!message) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {message}
    </div>
  );
}

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

export default async function AdminOverviewPage(
  props: {
    searchParams: Promise<{ notice?: string }>;
  }
) {
  const searchParams = await props.searchParams;
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
        <Notice reason={searchParams.notice} />
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

  // R06: כותב תוכן — במקום נתוני החנות, קישורים למסכי התוכן בלבד
  if (user.role === 'NURSERY_WRITER' && user.nurseryId) {
    const enabled = await getEnabledModuleKeys(user.nurseryId);
    const links = [
      enabled.has('static_pages') ? { href: '/admin/pages', label: 'עמודים' } : null,
      enabled.has('blog') ? { href: '/admin/blog', label: 'בלוג' } : null,
    ].filter((l): l is { href: string; label: string } => Boolean(l));
    return (
      <div>
        <Notice reason={searchParams.notice} />
        <h1 className="mb-2 text-2xl font-bold">שלום</h1>
        <p className="mb-6 text-sm text-gray-500">כותב תוכן — יש לך גישה לעריכת התוכן של האתר.</p>
        {links.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {links.map((l) => (
              <Stat key={l.href} label="מעבר לעריכה" value={l.label} href={l.href} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">מסכי התוכן אינם פעילים במשתלה זו.</p>
        )}
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

  const [total, active, outOfStock, orders, seoProducts] = await Promise.all([
    prisma.nurseryProduct.count({ where: { nurseryId: user.nurseryId } }),
    prisma.nurseryProduct.count({ where: { nurseryId: user.nurseryId, isActive: true } }),
    prisma.nurseryProduct.count({ where: { nurseryId: user.nurseryId, stockQuantity: { lte: 0 } } }),
    prisma.order.count({ where: { nurseryId: user.nurseryId } }),
    prisma.nurseryProduct.findMany({
      where: { nurseryId: user.nurseryId },
      select: {
        customTitle: true,
        customDescription: true,
        customImageUrl: true,
        seoMetaTitle: true,
        seoMetaDescription: true,
        plant: { select: { description: true, imageUrl: true } },
        supply: { select: { description: true, imageUrl: true } },
        catalogOverrides: true,
        ...catalogRevisionInclude,
      },
    }).then((rows) => rows.map(localizeProduct)),
  ]);
  const needsSeo = seoProducts.filter((p) => scoreProductSeo(p).level !== 'good').length;

  const catalogUpdates = await pendingUpdateCount(prisma, user.nurseryId);

  // §8.04: התראת מלאי נמוך לפי וריאנט (סף ברירת מחדל 5), במוצרים ובווריאנטים פעילים בלבד
  const lowStock = await prisma.$queryRaw<
    Array<{ id: string; name: string; available: number; title: string }>
  >`
    SELECT v."id", v."name", (v."stock_quantity" - v."reserved_quantity")::int AS available,
           COALESCE(p."custom_title", pl."hebrew_name", s."title", 'מוצר') AS title
    FROM "product_variants" v
    JOIN "nursery_products" p ON p."id" = v."nursery_product_id"
    LEFT JOIN "plants" pl ON pl."id" = p."plant_id"
    LEFT JOIN "master_supplies" s ON s."id" = p."supply_id"
    WHERE v."nursery_id" = ${user.nurseryId} AND v."is_active" AND p."is_active"
      AND v."stock_quantity" - v."reserved_quantity" <= ${LOW_STOCK_THRESHOLD}
    ORDER BY available ASC, title ASC
    LIMIT 12`;

  return (
    <div>
      <Notice reason={searchParams.notice} />
      <h1 className="mb-1 text-2xl font-bold">{user.nursery?.name}</h1>
      <p className="mb-6 text-sm text-gray-500">סקירת החנות שלך</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="סה״כ מוצרים" value={total} href="/admin/products" />
        <Stat label="פעילים" value={active} href="/admin/products" />
        <Stat label="אזלו מהמלאי" value={outOfStock} href="/admin/products" />
        <Stat label="הזמנות" value={orders} href="/admin/orders" />
        <Stat label="מוצרים לשיפור SEO" value={needsSeo} href="/admin/products" />
      </div>

      {catalogUpdates > 0 && (
        <Link
          href="/admin/catalog-updates"
          className="mt-8 block rounded-xl border border-sky-200 bg-sky-50 p-5 text-sky-900 hover:bg-sky-100"
        >
          <span className="font-bold">{catalogUpdates} עדכונים מהקטלוג המרכזי ממתינים לאישורכם</span>
          <span className="mt-1 block text-sm">מידע על צמחים/ציוד שמוצגים בחנות שלכם השתנה. הם לא יתעדכנו בחנות עד שתאשרו.</span>
        </Link>
      )}

      {lowStock.length > 0 && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-bold text-amber-900">מלאי נמוך ({LOW_STOCK_THRESHOLD} יחידות או פחות)</h2>
          <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {lowStock.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 rounded-lg bg-white px-3 py-1.5">
                <span className="truncate">{lineTitle(v.title, v.name)}</span>
                <span className={v.available <= 0 ? 'font-medium text-rose-700' : 'text-amber-800'}>
                  {v.available <= 0 ? 'אזל' : `${v.available} יח׳`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
