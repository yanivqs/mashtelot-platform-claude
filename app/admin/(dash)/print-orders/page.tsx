import { itemDisplay } from '@/lib/print-templates-admin';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';
import { PrintStatusSelect, QuotePriceForm } from './controls';
import { ProductionPanel, type ProductionVM } from './production-panel';
import { gateFor } from '@/lib/print-production';
import { nextStatuses, type ProductionStatus } from '@/lib/print-release';
import { signDownloadUrl } from '@/lib/print-storage';

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });

type Snapshot = { productionFile?: { sha256: string }; items?: Array<{ title: string | null; artwork: { version: number } | null }> };

export const dynamic = 'force-dynamic';

export default async function PrintOrdersPage() {
  await requireUser(['SUPER_ADMIN']);

  const [orders, productCount] = await Promise.all([
    prisma.printOrder.findMany({
      include: {
        nursery: { select: { name: true } },
        orderedBy: { select: { email: true } },
        items: { include: { printProduct: { select: { title: true } } } },
        productionFile: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.printProduct.count(),
  ]);

  // PT-06: פאנל ייצור להזמנות מתבנית (הזמנות ממוצרים ישנים — בזרימה הקודמת)
  const production = new Map<string, ProductionVM>();
  for (const o of orders) {
    if (!o.items.some((i) => i.templateVersionId) || o.status === 'QUOTE_REQUESTED') continue;
    const gate = await gateFor(prisma, o.id, true);
    if (!gate) continue;
    const snap = o.releaseSnapshot as Snapshot | null;
    const status = o.productionStatus as ProductionStatus;
    production.set(o.id, {
      orderId: o.id,
      status,
      released: Boolean(o.releasedAt),
      gate,
      needsSpecApproval: !o.specApprovedAt && o.items.some((i) => i.templateVersionId && !i.savedRevisionId),
      productionFile: o.productionFile
        ? { name: o.productionFile.originalName, url: await signDownloadUrl(o.productionFile.id), sha256: o.productionFile.sha256 }
        : null,
      snapshot:
        o.releasedAt && snap
          ? {
              at: dateFmt.format(o.releasedAt),
              by: o.releasedBy,
              fileSha: snap.productionFile?.sha256 ?? '',
              artworks: (snap.items ?? []).filter((i) => i.artwork).map((i) => `${i.title ?? ''} — גרסה ${i.artwork!.version}`),
            }
          : null,
      note: o.productionNote,
      next: nextStatuses(status, Boolean(o.releasedAt)),
    });
  }

  return (
    <div className="max-w-4xl space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">הזמנות דפוס נכנסות</h1>
          <p className="text-sm text-gray-500">{orders.length} הזמנות מהמשתלות</p>
        </div>
        <Link
          href="/admin/print-orders/products"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          ניהול מוצרי דפוס ({productCount})
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          אין הזמנות דפוס עדיין.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{o.nursery.name}</p>
                  <p className="text-xs text-gray-400">
                    {o.createdAt.toLocaleString('he-IL')}
                    {o.orderedBy?.email ? ` · ${o.orderedBy.email}` : ''}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-gray-900">
                    {formatPrice(o.totalAmount.toString())}
                  </p>
                  <div className="mt-1">
                    {o.status === 'QUOTE_REQUESTED' ? (
                      <QuotePriceForm id={o.id} />
                    ) : (
                      <PrintStatusSelect id={o.id} status={o.status} />
                    )}
                  </div>
                </div>
              </div>
              <ul className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                {o.items.map((it) => (
                  <li key={it.id} className="flex justify-between py-0.5">
                    <span>
                      {itemDisplay(it).title} × {it.quantity}
                      {itemDisplay(it).details.length > 0 && (
                        <span className="block text-xs text-gray-500">{itemDisplay(it).details.join(' · ')}</span>
                      )}
                    </span>
                    <span>{formatPrice(Number(it.unitPrice) * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              {production.has(o.id) && (
                <div className="mt-3">
                  <ProductionPanel p={production.get(o.id)!} />
                </div>
              )}
              {(o.notes || o.artworkUrl) && (
                <div className="mt-2 space-y-1 text-sm">
                  {o.notes && <p className="text-gray-500">הערות: {o.notes}</p>}
                  {o.artworkUrl && (
                    <a
                      href={o.artworkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-700 hover:underline"
                    >
                      קובץ גרפי מצורף ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
