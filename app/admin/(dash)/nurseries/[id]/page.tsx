import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getNurseryModuleMap } from '@/lib/module-access';
import { NurseryProfileForm } from '../profile-form';
import { nurseryToFormValues } from '../form-values';
import { NurseryModulesForm, type ModuleStateVM } from '../modules-form';
import { ResetMfaButton } from '../reset-mfa';

export const dynamic = 'force-dynamic';

export default async function EditNurseryPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requireUser(['SUPER_ADMIN']);

  const nursery = await prisma.nursery.findUnique({ where: { id: params.id } });
  if (!nursery) notFound();

  const users = await prisma.user.findMany({
    where: { nurseryId: nursery.id },
    select: { id: true, email: true, mfaEnabledAt: true },
    orderBy: { email: 'asc' },
  });
  const moduleMap = await getNurseryModuleMap(nursery.id);
  const moduleStates: Record<string, ModuleStateVM> = {};
  for (const [key, state] of moduleMap) moduleStates[key] = state;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/nurseries"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לרשימת המשתלות
      </Link>

      <h1 className="mb-1 text-2xl font-bold">{nursery.name}</h1>
      <p className="mb-6 text-sm text-gray-500" dir="ltr">
        {nursery.subdomain}
      </p>

      <Link
        href={`/admin/nurseries/${nursery.id}/images`}
        className="mb-6 inline-block rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        תיקיית התמונות של המשתלה
      </Link>

      <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold">מודולים משויכים</h2>
        <NurseryModulesForm nurseryId={nursery.id} states={moduleStates} />
      </div>

      <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-bold">משתמשי המשתלה</h2>
        <p className="mb-3 text-sm text-gray-500">משתמש שאיבד את הטלפון ואת קודי השחזור — איפוס האימות הדו-שלבי (מנתק את כל המכשירים שלו).</p>
        {users.length === 0 ? (
          <p className="text-sm text-gray-500">אין משתמשים.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
                <span dir="ltr">{u.email}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${u.mfaEnabledAt ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {u.mfaEnabledAt ? 'אימות דו-שלבי פעיל' : 'ללא אימות דו-שלבי'}
                </span>
                {u.mfaEnabledAt && <ResetMfaButton userId={u.id} email={u.email} />}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold">פרטי משתלה ועיצוב</h2>
        <NurseryProfileForm nursery={nurseryToFormValues(nursery)} scope="super" />
      </div>
    </div>
  );
}
