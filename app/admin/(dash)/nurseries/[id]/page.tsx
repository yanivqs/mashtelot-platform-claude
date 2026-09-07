import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getNurseryModuleMap } from '@/lib/module-access';
import { NurseryProfileForm } from '../profile-form';
import { nurseryToFormValues } from '../form-values';
import { NurseryModulesForm, type ModuleStateVM } from '../modules-form';

export const dynamic = 'force-dynamic';

export default async function EditNurseryPage({ params }: { params: { id: string } }) {
  await requireUser(['SUPER_ADMIN']);

  const nursery = await prisma.nursery.findUnique({ where: { id: params.id } });
  if (!nursery) notFound();

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

      <div className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold">מודולים משויכים</h2>
        <NurseryModulesForm nurseryId={nursery.id} states={moduleStates} />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-bold">פרטי משתלה ועיצוב</h2>
        <NurseryProfileForm nursery={nurseryToFormValues(nursery)} scope="super" />
      </div>
    </div>
  );
}
