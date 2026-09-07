import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NurseryProfileForm } from '../profile-form';
import { nurseryToFormValues } from '../form-values';

export const dynamic = 'force-dynamic';

export default async function EditNurseryPage({ params }: { params: { id: string } }) {
  await requireUser(['SUPER_ADMIN']);

  const nursery = await prisma.nursery.findUnique({ where: { id: params.id } });
  if (!nursery) notFound();

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

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <NurseryProfileForm nursery={nurseryToFormValues(nursery)} scope="super" />
      </div>
    </div>
  );
}
