import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ManufacturerForm } from './forms';
import { ManufacturerLogo } from '@/components/manufacturer-logo';

export const dynamic = 'force-dynamic';

/** ספקים ויצרנים (ברמת הפלטפורמה). המוצרים שלהם — בקטלוג הציוד; משתלות מושכות אותם ובוחרות יצרן למוצר. */
export default async function ManufacturersPage() {
  await requireUser(['SUPER_ADMIN']);
  const rows = await prisma.manufacturer.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { supplies: true, nurseryProducts: true } } },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ספקים ויצרנים</h1>
        <p className="mt-1 text-sm text-gray-500">
          לכל ספק או יצרן יש שם ולוגו, ומשייכים אליו מוצרים ב
          <Link href="/admin/supplies" className="text-brand-700 hover:underline">
            קטלוג הציוד
          </Link>
          . משתלות מושכות את המוצרים לפי יצרן, ובוחרות יצרן גם למוצרים שהן יוצרות בעצמן.
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">ספק / יצרן חדש</h2>
        <ManufacturerForm />
      </section>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">עדיין אין ספקים או יצרנים.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((m) => (
            <li key={m.id}>
              <Link
                href={`/admin/manufacturers/${m.id}`}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:border-brand-200"
              >
                <ManufacturerLogo name={m.name} logoUrl={m.logoUrl} className="h-14 w-14 text-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{m.name}</span>
                  <span className="block text-xs text-gray-500">
                    {m._count.supplies} מוצרים בקטלוג · {m._count.nurseryProducts} במשתלות
                  </span>
                </span>
                {!m.isActive && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">מושבת</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
