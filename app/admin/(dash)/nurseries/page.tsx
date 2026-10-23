import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { tenantOrigin } from '@/lib/seo';
import { CreateNurseryForm } from './create-form';
import { NurseryStatusSelect } from './status-select';
import { NURSERY_STATUS_CLS, NURSERY_STATUS_LABELS } from '@/lib/nursery-lifecycle';

export const dynamic = 'force-dynamic';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost:3000';

export default async function AdminNurseriesPage() {
  await requireUser(['SUPER_ADMIN']);

  const nurseries = await prisma.nursery.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { nurseryProducts: true, orders: true } },
      users: { where: { role: 'NURSERY_OWNER' }, select: { email: true } },
    },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">משתלות</h1>

      <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold">הוספת משתלה חדשה</h2>
        <CreateNurseryForm />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {nurseries.map((n) => (
          <div key={n.id} className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{n.name}</p>
              <p className="truncate text-xs text-gray-400">
                {n.customDomain || `${n.subdomain}.${ROOT_DOMAIN}`}
                {n.users[0] ? ` · ${n.users[0].email}` : ' · אין משתמש בעלים'}
              </p>
            </div>
            <span className="hidden text-xs text-gray-500 sm:block">
              {n._count.nurseryProducts} מוצרים · {n._count.orders} הזמנות
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NURSERY_STATUS_CLS[n.status]}`} data-testid={`status-${n.subdomain}`}>
              {NURSERY_STATUS_LABELS[n.status]}
            </span>
            <a
              href={tenantOrigin(n)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-gray-600 hover:underline"
            >
              לחנות ↗
            </a>
            <Link
              href={`/admin/nurseries/${n.id}`}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              עריכה
            </Link>
            <NurseryStatusSelect id={n.id} name={n.name} status={n.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
