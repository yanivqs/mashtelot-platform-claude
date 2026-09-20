import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { commitImport, type ImportPayload } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ImportReportPage({ params }: { params: { jobId: string } }) {
  await requireUser(['SUPER_ADMIN']);

  const job = await prisma.importJob.findUnique({ where: { id: params.jobId } });
  if (!job) notFound();

  const payload = job.payload as unknown as ImportPayload;
  const commitWithJob = commitImport.bind(null, job.id);

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/catalog/import"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לייבוא
      </Link>

      <div>
        <h1 className="text-2xl font-bold">תוצאות בדיקה: {job.originalFilename}</h1>
        <p className="text-sm text-gray-500">
          {job.status === 'COMMITTED'
            ? 'הייבוא הזה כבר אושר וייובא.'
            : 'הקובץ עדיין לא שונה — זו רק תצוגה מקדימה.'}
        </p>
      </div>

      {payload.alreadyImportedAt && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          שימו לב: קובץ זהה (אותו hash) כבר יובא בעבר ב-
          {new Date(payload.alreadyImportedAt).toLocaleString('he-IL')}.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-700">{job.createCount}</p>
          <p className="text-xs text-gray-500">חדשים (CREATE)</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-blue-700">{job.updateCount}</p>
          <p className="text-xs text-gray-500">עדכונים (UPDATE)</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-red-700">{job.errorCount}</p>
          <p className="text-xs text-gray-500">שגיאות</p>
        </div>
      </div>

      {payload.errors.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-gray-900">
            שורות עם שגיאה {job.errorCount > payload.errors.length && `(מוצגות ${payload.errors.length} ראשונות)`}
          </h2>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            {payload.errors.map((e, i) => (
              <div key={i} className="flex gap-3 border-b border-gray-50 px-4 py-2 text-sm last:border-0">
                <span className="shrink-0 text-gray-400">שורה {e.row}</span>
                <span className="text-red-700">{e.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {job.createCount + job.updateCount > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-gray-900">דוגמה (20 ראשונות)</h2>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            {payload.rows.slice(0, 20).map((r) => (
              <div
                key={r.plantId}
                className="flex gap-3 border-b border-gray-50 px-4 py-2 text-sm last:border-0"
              >
                <span className="shrink-0 text-gray-400">#{r.plantId}</span>
                <span className="text-gray-900">{r.hebrewName}</span>
                {r.latinName && <span className="text-gray-400">{r.latinName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {job.status === 'DRY_RUN_COMPLETE' && (
        <form action={commitWithJob}>
          <button
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            disabled={job.createCount + job.updateCount === 0}
          >
            אישור וייבוא ({job.createCount + job.updateCount} שורות)
          </button>
        </form>
      )}
    </div>
  );
}
