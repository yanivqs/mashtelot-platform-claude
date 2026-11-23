import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { DeleteManufacturerForm, ManufacturerForm } from '../forms';

export const dynamic = 'force-dynamic';

export default async function ManufacturerPage(props: { params: Promise<{ id: string }> }) {
  await requireUser(['SUPER_ADMIN']);
  const { id } = await props.params;
  const m = await prisma.manufacturer.findUnique({
    where: { id },
    include: {
      supplies: { orderBy: { title: 'asc' }, include: { _count: { select: { nurseryProducts: true } } } },
      _count: { select: { nurseryProducts: true } },
    },
  });
  if (!m) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/manufacturers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowRight className="h-4 w-4" />
        חזרה לספקים ויצרנים
      </Link>
      <h1 className="text-2xl font-bold">{m.name}</h1>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">פרטים</h2>
        <ManufacturerForm value={{ id: m.id, name: m.name, logoUrl: m.logoUrl, website: m.website, description: m.description, isActive: m.isActive }} />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">מוצרים בקטלוג ({m.supplies.length})</h2>
          <Link
            href={`/admin/supplies/new?manufacturer=${m.id}`}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" />
            מוצר חדש ל{m.name}
          </Link>
        </div>
        {m.supplies.length === 0 ? (
          <p className="text-sm text-gray-500">עדיין אין מוצרים.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {m.supplies.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/supplies/${s.id}`} className="flex items-center gap-3 py-2 hover:bg-gray-50">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-50">
                    {s.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.title}</span>
                    <span className="block text-xs text-gray-500" dir="ltr">
                      {[s.manufacturerCode, s.barcode].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="text-xs text-gray-500">{s.suggestedPrice ? formatPrice(s.suggestedPrice.toString()) : ''}</span>
                  <span className="text-xs text-gray-500">{s._count.nurseryProducts} משתלות</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {m.supplies.length === 0 && m._count.nurseryProducts === 0 && <DeleteManufacturerForm id={m.id} />}
    </div>
  );
}
