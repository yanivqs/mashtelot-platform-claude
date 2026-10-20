import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { listTeam, MAX_STAFF } from '@/lib/nursery-team';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';
import { AddMemberForm, MemberRow } from './forms';

export const dynamic = 'force-dynamic';

/** צוות המשתלה (R06-01/02) — בעל המשתלה בלבד. */
export default async function TeamPage() {
  const { nurseryId } = await requireNurseryPage({ area: 'owner' });
  const team = await listTeam(prisma, nurseryId);
  const active = team.filter((m) => !m.disabledAt).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">צוות</h1>
        <p className="mt-1 text-sm text-gray-500">
          <b>עובד</b> — מנהל את כל המשתלה, חוץ מהצוות ומ&quot;החשבון שלי&quot;. <b>כותב תוכן</b> — עמודים ובלוג בלבד. את הסיסמה קובעים
          ומאפסים כאן. עד {MAX_STAFF} עובדים פעילים ({active} כעת).
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">הוספת עובד</h2>
        <AddMemberForm minPassword={MIN_PASSWORD_LENGTH} full={active >= MAX_STAFF} />
      </section>

      {team.length > 0 && (
        <section className="space-y-3">
          {team.map((m) => (
            <MemberRow
              key={m.id}
              m={{ id: m.id, email: m.email, fullName: m.fullName, role: m.role as 'NURSERY_STAFF' | 'NURSERY_WRITER', disabled: Boolean(m.disabledAt) }}
              minPassword={MIN_PASSWORD_LENGTH}
            />
          ))}
        </section>
      )}
    </div>
  );
}
