import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { requireAnyModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { addCatalogItem } from './actions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

interface Props {
  searchParams: { q?: string; tab?: string; page?: string };
}

export default async function BrowseCatalogPage({ searchParams }: Props) {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireAnyModule(['plant_catalog', 'supplies']);
  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);

  if (!nurseryId) return <p className="text-gray-500">אין משתלה משויכת.</p>;

  const tab = searchParams.tab === 'supplies' ? 'supplies' : 'plants';
  const q = searchParams.q?.trim() || '';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);

  const owned = await prisma.nurseryProduct.findMany({
    where: { nurseryId },
    select: { plantId: true, supplyId: true },
  });
  const ownedPlants = new Set(owned.map((o) => o.plantId).filter(Boolean));
  const ownedSupplies = new Set(owned.map((o) => o.supplyId).filter(Boolean));

  const rows: Array<{
    id: string;
    kind: 'plant' | 'supply';
    title: string;
    sub: string | null;
    image: string | null;
    owned: boolean;
  }> = [];
  let total = 0;

  if (tab === 'plants') {
    const where = q
      ? {
          OR: [
            { hebrewName: { contains: q, mode: 'insensitive' as const } },
            { latinName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [plants, count] = await Promise.all([
      prisma.plant.findMany({
        where,
        orderBy: { hebrewName: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.plant.count({ where }),
    ]);
    total = count;
    for (const p of plants) {
      rows.push({
        id: p.id,
        kind: 'plant',
        title: p.hebrewName,
        sub: p.latinName,
        image: p.imageUrl,
        owned: ownedPlants.has(p.id),
      });
    }
  } else {
    const where = q ? { title: { contains: q, mode: 'insensitive' as const } } : {};
    const [supplies, count] = await Promise.all([
      prisma.masterSupply.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.masterSupply.count({ where }),
    ]);
    total = count;
    for (const s of supplies) {
      rows.push({
        id: s.id,
        kind: 'supply',
        title: s.title,
        sub: s.brand,
        image: s.imageUrl,
        owned: ownedSupplies.has(s.id),
      });
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabHref = (t: string) => `/admin/products/browse?tab=${t}`;
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    sp.set('tab', tab);
    if (q) sp.set('q', q);
    if (p > 1) sp.set('page', String(p));
    return `/admin/products/browse?${sp.toString()}`;
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">הוספת מוצרים</h1>
      <p className="mb-6 text-sm text-gray-500">
        בחר פריטים מהקטלוג הבוטני המרכזי והוסף אותם לחנות שלך עם מחיר.
      </p>

      <div className="mb-4 flex gap-2">
        <Link
          href={tabHref('plants')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'plants' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          צמחים
        </Link>
        <Link
          href={tabHref('supplies')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'supplies' ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          ציוד וחומרים
        </Link>
      </div>

      <form method="get" className="mb-6 flex gap-3">
        <input type="hidden" name="tab" value={tab} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="חיפוש בקטלוג..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <button className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white">חיפוש</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-lg">
              {row.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden>🪴</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{row.title}</p>
              {row.sub && <p className="truncate text-xs text-gray-400">{row.sub}</p>}
            </div>
            {row.owned ? (
              <span className="shrink-0 text-xs font-medium text-green-700">בחנות ✓</span>
            ) : (
              <form action={addCatalogItem} className="flex shrink-0 items-center gap-1.5">
                <input type="hidden" name="kind" value={row.kind} />
                <input type="hidden" name="refId" value={row.id} />
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="₪"
                  className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand-500"
                />
                <button className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                  הוסף
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              הקודם
            </Link>
          )}
          <span className="px-2 text-sm text-gray-500">
            עמוד {page} מתוך {pageCount}
          </span>
          {page < pageCount && (
            <Link href={pageHref(page + 1)} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              הבא
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
