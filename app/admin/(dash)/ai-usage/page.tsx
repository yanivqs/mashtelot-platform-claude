import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { aiSlugAvailable } from '@/lib/ai-slug';

export const dynamic = 'force-dynamic';

const FEATURE_LABELS: Record<string, string> = { product_slug: 'הצעת כתובת למוצר' };

interface UsageRow {
  month: string;
  nursery_id: string | null;
  nursery_name: string | null;
  feature: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

/** שימוש בכלי AI לפי חודש, משתלה ותכונה — בסיס לחיוב עתידי. */
export default async function AiUsagePage() {
  await requireUser(['SUPER_ADMIN']);

  const rows = await prisma.$queryRaw<UsageRow[]>`
    select to_char(date_trunc('month', u.created_at at time zone 'Asia/Jerusalem'), 'YYYY-MM') as month,
           u.nursery_id, n.name as nursery_name, u.feature,
           count(*)::int as calls,
           coalesce(sum(u.input_tokens), 0)::int as input_tokens,
           coalesce(sum(u.output_tokens), 0)::int as output_tokens
    from ai_usage u left join nurseries n on n.id = u.nursery_id
    group by 1, 2, 3, 4
    order by 1 desc, calls desc
    limit 500`;

  const months = [...new Set(rows.map((r) => r.month))];

  return (
    <div>
      <h1 className="text-2xl font-bold">שימוש ב-AI</h1>
      <p className="mb-6 text-sm text-gray-500">
        כל לחיצה על כפתורי ה-AI באדמין המשתלות נספרת כאן, לפי חודש ומשתלה (לחיוב עתידי).
        {!aiSlugAvailable() && <span className="text-amber-700"> · מפתח ANTHROPIC_API_KEY לא מוגדר — הכפתורים כבויים.</span>}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">עדיין אין שימוש.</p>
      ) : (
        <div className="space-y-6">
          {months.map((m) => {
            const list = rows.filter((r) => r.month === m);
            const total = list.reduce((s, r) => s + r.calls, 0);
            return (
              <section key={m}>
                <h2 className="mb-2 font-bold">
                  {m} <span className="text-sm font-normal text-gray-500">· {total} שימושים</span>
                </h2>
                <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-right text-xs text-gray-500">
                      <tr>
                        <th className="px-4 py-2 font-semibold">משתלה</th>
                        <th className="px-4 py-2 font-semibold">תכונה</th>
                        <th className="px-4 py-2 font-semibold">שימושים</th>
                        <th className="px-4 py-2 font-semibold">טוקנים (קלט / פלט)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => (
                        <tr key={`${r.nursery_id}-${r.feature}`} className="border-t border-gray-100">
                          <td className="px-4 py-2">{r.nursery_name ?? 'משתלה שנמחקה'}</td>
                          <td className="px-4 py-2">{FEATURE_LABELS[r.feature] ?? r.feature}</td>
                          <td className="px-4 py-2 font-medium">{r.calls}</td>
                          <td className="px-4 py-2 text-gray-500" dir="ltr">
                            {r.input_tokens.toLocaleString('en')} / {r.output_tokens.toLocaleString('en')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
