import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAccountStatus, getPlatformContact } from '@/lib/nursery-account';
import { BLOCK_REASON_TEXT, formatAccountDate } from '@/lib/nursery-billing';

export const dynamic = 'force-dynamic';

/** מה שמשתלה חסומה רואה: הסיבה ופרטי הקשר בלבד. */
export default async function AccountBlockedPage() {
  const user = await requireUser();
  if (!user.nurseryId) redirect('/admin');
  const status = await getAccountStatus(user.nurseryId);
  if (status.state !== 'BLOCKED') redirect('/admin');
  const contact = await getPlatformContact();

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm" data-testid="account-blocked">
      <div className="flex items-center gap-2 text-amber-900">
        <Lock className="h-5 w-5" />
        <h1 className="text-xl font-bold">הגישה לניהול המשתלה מוגבלת</h1>
      </div>
      <p className="mt-3 text-gray-800">{BLOCK_REASON_TEXT[status.reason]}</p>
      {status.note && <p className="mt-1 text-gray-800">סיבה: {status.note}</p>}
      {status.dueDate && <p className="mt-1 text-sm text-gray-600">{status.reason === 'EXPIRED' ? 'התוקף הסתיים' : 'מועד החיוב היה'} ב-{formatAccountDate(status.dueDate)}.</p>}
      <p className="mt-3 text-sm text-gray-700">החנות שלכם ממשיכה לפעול ולקבל הזמנות. כדי לחדש את הגישה, פנו למנהל הפלטפורמה:</p>
      <ul className="mt-2 space-y-1 text-sm">
        {contact.name && <li className="font-medium">{contact.name}</li>}
        {contact.phone && (
          <li>
            טלפון:{' '}
            <a href={`tel:${contact.phone}`} dir="ltr" className="text-brand-800 underline">
              {contact.phone}
            </a>
          </li>
        )}
        <li>
          מייל:{' '}
          <a href={`mailto:${contact.email}`} dir="ltr" className="text-brand-800 underline">
            {contact.email}
          </a>
        </li>
      </ul>
    </div>
  );
}
