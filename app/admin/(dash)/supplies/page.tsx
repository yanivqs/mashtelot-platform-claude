import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { isSupplyCategory, SUPPLY_CATEGORIES, SUPPLY_CATEGORY_LABELS } from '@/lib/manufacturers';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ q?: string; manufacturer?: string; category?: string; page?: string }>;
}

/** קטלוג הציוד המרכזי (master_supplies): המוצרים שמשתלות מושכות, לפי ספק/יצרן. */
export default async function SuppliesPage(props: Props) {
  await requireUser(['SUPER_ADMIN']);
  const sp = await props.searchParams;
  const q = sp.q?.trim() ?? '';
  const manufacturer = sp.manufacturer ?? '';
  const category = sp.category && isSupplyCategory(sp.category) ? sp.category : '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: Prisma.MasterSupplyWhereInput = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { manufacturerCode: { contains: q, mode: 'insensitive' } },
            { barcode: { contains: q } },
          ],
        }
      : {}),
    ...(manufacturer === 'none' ? { manufacturerId: null } : manufacturer ? { manufacturerId: manufacturer } : {}),
    ...(category ? { category } : {}),
  };
  const [rows, total, manufacturers] = await Promise.all([
    prisma.masterSupply.findMany({
      where,
      orderBy: { title: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { manufacturer: { select: { name: true } }, _count: { select: { nurseryProducts: true } } },
    }),
    prisma.masterSupply.count({ where }),
    prisma.manufacturer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const pageHref = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (manufacturer) u.set('manufacturer', manufacturer);
    if (category) u.set('category', category);
    if (p > 1) u.set('page', String(p));
    return `/admin/supplies${u.size ? `?${u}` : ''}`;
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">קטלוג ציוד</h1>
          <p className="mt-1 text-sm text-gray-500">
            מוצרים שאינם צמחים (אדמה, עציצים, דשנים, כלים...) שמשתלות יכולות למשוך לחנות. משייכים כל מוצר ל
            <Link href="/admin/manufacturers" className="text-brand-700 hover:underline">
              ספק / יצרן
            </Link>
            .
          </p>
        </div>
        <Link href="/admin/supplies/new" className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          <Plus className="h-4 w-4" />
          מוצר חדש
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <label htmlFor="supplies-q" className="sr-only">
            חיפוש לפי שם, קוד יצרן או ברקוד
          </label>
          <input id="supplies-q" name="q" defaultValue={q} placeholder="שם, קוד יצרן או ברקוד" className="w-full rounded-lg border border-gray-200 py-2 pr-10 pl-3 text-sm" />
        </div>
        <label className="sr-only" htmlFor="supplies-m">
          ספק / יצרן
        </label>
        <select id="supplies-m" name="manufacturer" defaultValue={manufacturer} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">כל הספקים והיצרנים</option>
          <option value="none">בלי יצרן</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="supplies-c">
          קטגוריה
        </label>
        <select id="supplies-c" name="category" defaultValue={category} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">כל הקטגוריות</option>
          {SUPPLY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {SUPPLY_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">סינון</button>
      </form>

      <p className="text-sm text-gray-600">{total} מוצרים</p>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right text-xs text-gray-500">
            <tr>
              <th className="p-3">מוצר</th>
              <th className="p-3">ספק / יצרן</th>
              <th className="p-3">קוד יצרן</th>
              <th className="p-3">ברקוד</th>
              <th className="p-3">מחיר מומלץ</th>
              <th className="p-3">משתלות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="p-3">
                  <Link href={`/admin/supplies/${s.id}`} className="font-medium text-brand-700 hover:underline">
                    {s.title}
                  </Link>
                  <span className="block text-xs text-gray-500">{SUPPLY_CATEGORY_LABELS[s.category]}</span>
                </td>
                <td className="p-3">{s.manufacturer?.name ?? <span className="text-gray-400">—</span>}</td>
                <td className="p-3" dir="ltr">
                  {s.manufacturerCode ?? ''}
                </td>
                <td className="p-3" dir="ltr">
                  {s.barcode ?? ''}
                </td>
                <td className="p-3">{s.suggestedPrice ? formatPrice(s.suggestedPrice.toString()) : ''}</td>
                <td className="p-3">{s._count.nurseryProducts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={pageHref} />
    </div>
  );
}
