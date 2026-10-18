import { requireUser } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';
import { PasswordForm } from './password-form';
import { RevokeSessionsForm } from './revoke-sessions-form';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER']);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">החשבון שלי</h1>
        <p className="text-sm text-gray-500" dir="ltr">
          {user.email}
        </p>
      </div>
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
