import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { specDiff } from '@/lib/print-saved';
import { ReviewForm } from './review-form';

export const dynamic = 'force-dynamic';

type Display = { display?: Array<{ label: string; value: string }> };
const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });

/** תור אישורי מפרט של מוצרים קבועים (PT-04) — בית הדפוס מאשר או דוחה עם הערה. */
export default async function PrintSpecsPage() {
  await requireUser(['SUPER_ADMIN']);
  const pending = await prisma.printSavedRevision.findMany({
    where: { status: 'SUBMITTED' },
    orderBy: { submittedAt: 'asc' },
    include: {
      templateVersion: { include: { template: { select: { title: true } } } },
      savedProduct: { include: { nursery: { select: { name: true } }, activeRevision: true } },
    },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">אישורי מפרט — מוצרים קבועים</h1>
        <p className="mt-1 text-sm text-gray-500">
          אחרי אישור המפרט ננעל, והמשתלה מזמינה ממנו שוב עם כמות והערות בלבד. בקשת שינוי מוצגת מול המפרט המאושר.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">אין בקשות ממתינות. ✓</p>
      ) : (
        pending.map((r) => {
          const values = r.values as Display;
          const active = r.savedProduct.activeRevision;
          const diff = active ? specDiff(active.values as Display, values) : null;
          return (
            <section key={r.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">
                  {r.savedProduct.nursery.name} · {r.savedProduct.name}
                </h2>
                <span className="text-xs text-gray-500">
                  {r.templateVersion.template.title} (גרסה {r.templateVersion.version}) · {active ? `בקשת שינוי — מפרט ${r.revision}` : 'מוצר חדש'} ·{' '}
                  {dateFmt.format(r.submittedAt)} · {r.submittedBy ?? ''}
                </span>
              </div>
              {diff ? (
                <table className="mb-3 w-full text-sm">
                  <thead className="text-right text-xs text-gray-500">
                    <tr>
                      <th className="py-1 font-medium">שדה</th>
                      <th className="py-1 font-medium">מאושר היום</th>
                      <th className="py-1 font-medium">מבוקש</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {diff.map((d) => (
                      <tr key={d.label}>
                        <td className="py-1.5 font-medium text-gray-700">{d.label}</td>
                        <td className="py-1.5 text-gray-500">{d.from}</td>
                        <td className="py-1.5">{d.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <ul className="mb-3 text-sm">
                  {(values.display ?? []).map((d) => (
                    <li key={d.label}>
                      <span className="text-gray-500">{d.label}:</span> {d.value}
                    </li>
                  ))}
                </ul>
              )}
              <ReviewForm revisionId={r.id} />
            </section>
          );
        })
      )}
    </div>
  );
}
