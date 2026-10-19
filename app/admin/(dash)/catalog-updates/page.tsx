import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { pendingUpdates, productsWithLocalFields } from '@/lib/catalog-sync-admin';
import { displayValue } from '@/lib/catalog-sync';
import { restoreFieldAction } from './actions';
import { SyncForm } from './sync-form';

export const dynamic = 'force-dynamic';

export default async function CatalogUpdatesPage() {
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });
  const [pending, local] = await Promise.all([
    pendingUpdates(prisma, nurseryId),
    productsWithLocalFields(prisma, nurseryId),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">עדכונים מהקטלוג המרכזי</h1>
        <p className="mt-1 text-sm text-gray-500">
          כשמידע בקטלוג המרכזי משתנה, הוא לא משנה את החנות שלכם לבד — אתם מחליטים מה לעדכן. מחיר, מלאי,
          וריאנטים וקטגוריות לעולם לא מתעדכנים מהקטלוג.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          אין עדכונים ממתינים. ✓
        </p>
      ) : (
        <div className="space-y-4">
          {pending.map((u) => (
            <section key={u.productId} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">{u.title}</h2>
                <span className="text-xs text-gray-400">
                  {u.kind === 'plant' ? 'צמח' : 'ציוד'} · גרסה {u.fromVersion} ← {u.toVersion} · {u.diffs.length} שינויים
                </span>
              </div>
              <SyncForm productId={u.productId} toRevisionId={u.toRevisionId} diffs={u.diffs} />
            </section>
          ))}
        </div>
      )}

      {local.length > 0 && (
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-bold">שדות שנשמרו אצלכם (לא מתעדכנים מהקטלוג)</h2>
          <p className="mb-3 text-xs text-gray-500">החזרה לסנכרון מציגה מיד את הערך מהקטלוג המאושר, ועדכונים עתידיים בשדה יוצעו שוב.</p>
          <ul className="space-y-3">
            {local.map((row) => (
              <li key={row.productId}>
                <p className="mb-1 text-sm font-medium">{row.title}</p>
                <div className="flex flex-wrap gap-2">
                  {row.fields.map((f) => (
                    <form key={f.field} action={restoreFieldAction} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1 text-xs">
                      <input type="hidden" name="productId" value={row.productId} />
                      <input type="hidden" name="field" value={f.field} />
                      <span className="text-gray-700">
                        {f.label}: <span className="text-gray-500">{displayValue(f.field, f.value).slice(0, 40)}</span>
                      </span>
                      <button className="text-brand-700 hover:underline">החזרה לסנכרון</button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
