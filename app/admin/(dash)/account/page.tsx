import { requireUser } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';
import { PasswordForm } from './password-form';
import { RevokeSessionsForm } from './revoke-sessions-form';
import { MfaSection } from './mfa-section';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AccountPage(props: { searchParams: Promise<{ recovery?: string }> }) {
  const user = await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER']);
  const { recovery } = await props.searchParams;
  const recoveryLeft = user.mfaEnabledAt ? await prisma.userRecoveryCode.count({ where: { userId: user.id, usedAt: null } }) : 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">החשבון שלי</h1>
        <p className="text-sm text-gray-500" dir="ltr">
          {user.email}
        </p>
      </div>
      {recovery === '1' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          נכנסתם עם קוד שחזור (נותרו {recoveryLeft}). אם איבדתם את הטלפון — בטלו את האימות הדו-שלבי והפעילו מחדש על המכשיר החדש, או צרו קודי שחזור חדשים.
        </p>
      )}
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-bold">אימות דו-שלבי</h2>
        <p className="mb-4 text-sm text-gray-500">קוד מאפליקציה בטלפון בכל התחברות, בנוסף לסיסמה.</p>
        <MfaSection enabled={Boolean(user.mfaEnabledAt)} recoveryLeft={recoveryLeft} />
      </section>
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold">החלפת סיסמה</h2>
        <PasswordForm minLength={MIN_PASSWORD_LENGTH} />
      </section>
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-bold">מכשירים מחוברים</h2>
        <p className="mb-4 text-sm text-gray-500">
          חושדים שמישהו נכנס לחשבון? ניתוק כל המכשירים האחרים יחייב התחברות מחדש בכולם. המכשיר
          הנוכחי יישאר מחובר.
        </p>
        <RevokeSessionsForm />
      </section>
    </div>
  );
}
