import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NewTemplateForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function PrintTemplatesPage() {
  await requireUser(['SUPER_ADMIN']);
  const templates = await prisma.printTemplate.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { versions: { select: { version: true, status: true }, orderBy: { version: 'desc' } } },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">תבניות מוצרי דפוס</h1>
        <p className="mt-1 text-sm text-gray-500">
          מוצר דפוס מוגדר בתבנית: שדות שהמשתלה ממלאת, תנאים ביניהם ותמחור. כל פרסום יוצר גרסה שלא משתנה —
          הזמנות קיימות נשארות על הגרסה שבה הוזמנו.
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">מוצר חדש</h2>
        <NewTemplateForm />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {templates.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">אין עדיין תבניות.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {templates.map((t) => {
              const published = t.versions.find((v) => v.status === 'PUBLISHED');
              const draft = t.versions.find((v) => v.status === 'DRAFT');
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/admin/print-templates/${t.id}`} className="font-medium text-gray-900 hover:underline">
                    {t.title}
                  </Link>
                  <span className="flex flex-wrap gap-2 text-xs">
                    {published ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-700">גרסה {published.version} מפורסמת</span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">לא פורסם</span>
                    )}
                    {draft && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">טיוטה {draft.version}</span>}
                    <span className={`rounded-full px-2 py-0.5 ${t.isActive ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.isActive ? 'מוצג למשתלות' : 'מוסתר'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
