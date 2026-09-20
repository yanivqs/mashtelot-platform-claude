import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UploadForm } from './upload-form';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  await requireUser(['SUPER_ADMIN']);

  const recentJobs = await prisma.importJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link
          href="/admin/catalog"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה לקטלוג
        </Link>
        <h1 className="text-2xl font-bold">ייבוא צמחים מ-CSV</h1>
        <p className="text-sm text-gray-500">
          מעדכן/מוסיף לקטלוג המרכזי לפי plant_id — לא מוחק ולא נוגע במוצרים שכבר משויכים למשתלות.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <UploadForm />
      </div>

      {recentJobs.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-gray-900">ייבואים אחרונים</h2>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {recentJobs.map((j) => (
              <div
                key={j.id}
                className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-gray-900">{j.originalFilename}</span>
                <span className="text-xs text-gray-400">{j.createdAt.toLocaleString('he-IL')}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    j.status === 'COMMITTED'
                      ? 'bg-green-100 text-green-800'
                      : j.status === 'FAILED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {j.status === 'COMMITTED' ? 'יובא' : j.status === 'FAILED' ? 'נכשל' : 'ממתין לאישור'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
