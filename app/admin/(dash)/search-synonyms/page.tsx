import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteSynonymGroup } from './actions';
import { AddSynonymForm, EditSynonymForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function SearchSynonymsPage() {
  await requireUser(['SUPER_ADMIN']);
  const groups = await prisma.searchSynonymGroup.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">מילים נרדפות בחיפוש</h1>
        <p className="mt-1 text-sm text-gray-500">
          משותף לכל החנויות. חיפוש של כל מונח בקבוצה מוצא גם את השאר — למשל &quot;בזיליקום&quot; ימצא
          גם &quot;ריחן&quot;. אין צורך להוסיף יחיד/רבים, תחיליות (ה, ו, ב...) או אותיות סופיות — החיפוש
          מטפל בהם לבד, וגם בשגיאות כתיב קלות.
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">קבוצה חדשה</h2>
        <AddSynonymForm />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-5 py-3 font-bold">{groups.length} קבוצות</h2>
        {groups.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">אין עדיין קבוצות.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {groups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                <EditSynonymForm id={g.id} terms={g.terms} />
                <form action={deleteSynonymGroup}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">מחיקה</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
