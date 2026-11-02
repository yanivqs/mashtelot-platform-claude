import { requireUser } from '@/lib/auth';
import { PreflightNotes } from '@/components/print/preflight-notes';
import type { PreflightResult } from '@/lib/print-preflight';
import { prisma } from '@/lib/prisma';
import { signDownloadUrl } from '@/lib/print-storage';
import { ARTWORK_STATUS } from '@/lib/print-artwork-status';
import { DesignUpload, PhoneDecision, ProofUpload } from './forms';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`);

/** תור גרפיקה והגהות לבית הדפוס (PT-05): קבצים שממתינים להגהה, והגהות שממתינות לאישור המשתלה. */
export default async function PrintArtworkPage() {
  await requireUser(['SUPER_ADMIN']);
  const versions = await prisma.printArtworkVersion.findMany({
    where: { status: { in: ['UPLOADED', 'PROOF_SENT'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      file: true,
      proofFile: true,
      artwork: {
        include: {
          nursery: { select: { name: true } },
          savedProduct: { select: { name: true } },
          printOrder: { select: { createdAt: true, items: { select: { title: true }, take: 1 } } },
        },
      },
    },
  });
  // עבודות שביקשו עיצוב ועדיין אין להן קובץ
  const awaitingDesign = await prisma.printSavedProduct.findMany({
    where: {
      isArchived: false,
      artworks: { none: {} },
      revisions: { some: { orderItems: { some: { printOrder: { needsDesign: true, status: { not: 'CANCELLED' } } } } } },
    },
    orderBy: { createdAt: 'asc' },
    include: { nursery: { select: { name: true } }, activeRevision: { select: { values: true } }, revisions: { orderBy: { revision: 'desc' }, take: 1, select: { values: true } } },
  });
  const rows = await Promise.all(
    versions.map(async (v) => ({ v, fileUrl: await signDownloadUrl(v.fileId), proofUrl: v.proofFileId ? await signDownloadUrl(v.proofFileId) : null })),
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">גרפיקה והגהות</h1>
        <p className="mt-1 text-sm text-gray-500">
          הורידו את הקובץ, העלו הגהה — והמשתלה תאשר במערכת. אם המשתלה אישרה בטלפון, תעדו כאן עם מי ומתי. כל אישור
          מתייחס לגרסה הזו בלבד; גרסה חדשה מבטלת אותו.
        </p>
      </div>
      {awaitingDesign.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">ממתינות לעיצוב ({awaitingDesign.length})</h2>
          {awaitingDesign.map((j) => {
            const display = ((j.activeRevision?.values ?? j.revisions[0]?.values) as { display?: Array<{ label: string; value: string }> } | null)?.display ?? [];
            return (
              <div key={j.id} className="rounded-xl border border-sky-100 bg-white p-4 shadow-sm" data-testid="awaiting-design">
                <p className="font-medium">
                  {j.nursery.name} · {j.name}
                </p>
                {display.length > 0 && <p className="mt-0.5 text-xs text-gray-600">{display.map((d) => `${d.label}: ${d.value}`).join(' · ')}</p>}
                <div className="mt-2">
                  <DesignUpload savedProductId={j.id} />
                </div>
              </div>
            );
          })}
        </section>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">אין קבצים ממתינים. ✓</p>
      ) : (
        rows.map(({ v, fileUrl, proofUrl }) => {
          const subject = v.artwork.savedProduct
            ? `עבודה: ${v.artwork.savedProduct.name}`
            : `הזמנה ${v.artwork.printOrder ? dateFmt.format(v.artwork.printOrder.createdAt) : ''} — ${v.artwork.printOrder?.items[0]?.title ?? ''}`;
          return (
            <section key={v.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">
                  {v.artwork.nursery.name} · {subject}
                </h2>
                <span className={`rounded-full px-2 py-0.5 text-xs ${ARTWORK_STATUS[v.status].cls}`}>
                  גרסה {v.version} · {v.status === 'PROOF_SENT' ? 'ממתין לאישור המשתלה' : 'ממתין להגהה'}
                </span>
              </div>
              <p className="mb-3 text-sm">
                <a href={fileUrl} className="font-medium text-brand-700 hover:underline">
                  {v.file.originalName}
                </a>{' '}
                <span className="text-xs text-gray-500">
                  {v.file.mimeType} · {kb(v.file.sizeBytes)}
                  {v.file.widthPx ? ` · ${v.file.widthPx}×${v.file.heightPx}px` : ''} · SHA-256 {v.file.sha256.slice(0, 12)}… · {dateFmt.format(v.createdAt)}
                </span>
              </p>
              <div className="mb-3">
                <PreflightNotes result={v.file.preflight as PreflightResult | null} />
              </div>
              {v.status === 'UPLOADED' ? (
                <ProofUpload versionId={v.id} />
              ) : (
                <div className="space-y-2">
                  {proofUrl && (
                    <a href={proofUrl} className="text-sm text-brand-700 hover:underline">
                      ההגהה שנשלחה
                    </a>
                  )}
                  <PhoneDecision versionId={v.id} />
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
