import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { deleteRedirectAction } from './actions';
import { AddRedirectForm, ImportRedirectsForm } from './forms';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short' });

export default async function RedirectsPage() {
  const { nurseryId } = await requireNurseryPage();
  const rules = await prisma.redirect.findMany({ where: { nurseryId }, orderBy: { createdAt: 'desc' } });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הפניות מכתובות ישנות</h1>
        <p className="mt-1 text-sm text-gray-500">
          עברתם מאתר קודם? הפנו את הכתובות הישנות לדפים בחנות, כדי לא לאבד מבקרים ודירוג בגוגל. ההפניה
          קבועה (גוגל מעביר את הדירוג ליעד), ומופעלת רק כשהכתובת לא קיימת בחנות. אפשר להדביק כתובת מלאה של
          האתר הישן — נשמר רק הנתיב.
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">הפניה חדשה</h2>
        <AddRedirectForm />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-bold">יבוא מקובץ CSV</h2>
        <p className="mb-3 text-xs text-gray-500">
          עמודה ראשונה — כתובת ישנה, שנייה — יעד. שורת כותרת אופציונלית. עד 2,000 שורות. כתובת שכבר
          קיימת — היעד שלה מתעדכן.
        </p>
        <ImportRedirectsForm />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <h2 className="border-b border-gray-100 px-5 py-3 font-bold">{rules.length} הפניות</h2>
        {rules.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">אין עדיין הפניות.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">כתובת ישנה</th>
                  <th className="px-4 py-2 font-medium">יעד</th>
                  <th className="px-4 py-2 font-medium">כניסות</th>
                  <th className="px-4 py-2 font-medium">כניסה אחרונה</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-xs truncate px-4 py-2 font-mono text-xs" dir="ltr" title={r.fromPath}>
                      {r.fromPath}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 font-mono text-xs" dir="ltr" title={r.toPath}>
                      {r.toPath}
                    </td>
                    <td className="px-4 py-2">{r.hits}</td>
                    <td className="px-4 py-2 text-gray-500">{r.lastHitAt ? dateFmt.format(r.lastHitAt) : '—'}</td>
                    <td className="px-4 py-2 text-left">
                      <form action={deleteRedirectAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="rounded-lg px-3 py-1 text-xs text-red-600 hover:bg-red-50">מחיקה</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
