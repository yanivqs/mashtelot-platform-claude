import { requireUser } from '@/lib/auth';
import { MIN_PASSWORD_LENGTH } from '@/lib/account';
import { PasswordForm } from './password-form';

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
    </div>
  );
}
