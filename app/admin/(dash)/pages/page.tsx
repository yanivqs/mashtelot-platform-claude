import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminPagesList() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireModule('static_pages');

  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);

  if (!nurseryId) return <p className="text-gray-500">אין משתלה משויכת.</p>;

  const pages = await prisma.staticPage.findMany({
    where: { nurseryId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">עמודים סטטיים</h1>
          <p className="text-sm text-gray-500">{pages.length} עמודים</p>
        </div>
        <Link
          href="/admin/pages/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          עמוד חדש
        </Link>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          עדיין אין עמודים. צור עמוד "אודות", "תקנון" או "משלוחים".
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {pages.map((p) => (
            <Link
              key={p.id}
              href={`/admin/pages/${p.id}`}
              className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{p.title}</p>
                <p className="truncate text-xs text-gray-400" dir="ltr">
                  /{p.slug}
                </p>
              </div>
              {!p.showInNav && <span className="text-xs text-gray-400">מוסתר מהתפריט</span>}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {p.isPublished ? 'מפורסם' : 'טיוטה'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
