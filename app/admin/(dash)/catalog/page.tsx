import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  await requireUser(['SUPER_ADMIN']);

  const q = searchParams.q?.trim() || '';
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const where = q
    ? {
        OR: [
          { hebrewName: { contains: q, mode: 'insensitive' as const } },
          { latinName: { contains: q, mode: 'insensitive' as const } },
          { family: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [plants, total] = await Promise.all([
    prisma.plant.findMany({
      where,
      orderBy: { hebrewName: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.plant.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return s ? `/admin/catalog?${s}` : '/admin/catalog';
  };

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">קטלוג בוטני מרכזי</h1>
      <p className="mb-6 text-sm text-gray-500">{total.toLocaleString('he-IL')} צמחים</p>

      <form method="get" className="mb-6 flex max-w-lg gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="חיפוש לפי שם / משפחה..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <button className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white">חיפוש</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {plants.map((p) => (
          <Link
            key={p.id}
            href={`/admin/catalog/${p.id}`}
            className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden>🪴</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{p.hebrewName}</p>
              <p className="truncate text-xs text-gray-400">
                {[p.latinName, p.family].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            {p.plantType && <span className="text-xs text-gray-400">{p.plantType}</span>}
          </Link>
        ))}
      </div>

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              הקודם
            </Link>
          )}
          <span className="px-2 text-sm text-gray-500">
            עמוד {page} / {pageCount}
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
