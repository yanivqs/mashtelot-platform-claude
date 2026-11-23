import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DeleteSupplyForm, SupplyForm } from '../../manufacturers/forms';

export const dynamic = 'force-dynamic';

/** עריכת מוצר בקטלוג הציוד (או 'new'). */
export default async function SupplyPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ manufacturer?: string; created?: string }> }) {
  await requireUser(['SUPER_ADMIN']);
  const { id } = await props.params;
  const sp = await props.searchParams;
  const manufacturers = await prisma.manufacturer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } });
  const isNew = id === 'new';
  const s = isNew ? null : await prisma.masterSupply.findUnique({ where: { id }, include: { _count: { select: { nurseryProducts: true } } } });
  if (!isNew && !s) notFound();
  const backTo = s?.manufacturerId ?? sp.manufacturer;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={backTo ? `/admin/manufacturers/${backTo}` : '/admin/supplies'}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        {backTo ? 'חזרה לספק / יצרן' : 'חזרה לקטלוג הציוד'}
      </Link>
      <h1 className="text-2xl font-bold">{s ? s.title : 'מוצר חדש בקטלוג הציוד'}</h1>
      {sp.created && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">המוצר נוסף לקטלוג ✓</p>}
      {s && s._count.nurseryProducts > 0 && (
        <p className="text-sm text-gray-500">{s._count.nurseryProducts} משתלות משכו את המוצר. שינוי בשם, בתיאור, בתמונה או ביצרן יוצע להן כעדכון מהקטלוג.</p>
      )}
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <SupplyForm
          value={
            s
              ? {
                  id: s.id,
                  title: s.title,
                  manufacturerId: s.manufacturerId,
                  manufacturerCode: s.manufacturerCode,
                  barcode: s.barcode,
                  category: s.category,
                  description: s.description,
                  imageUrl: s.imageUrl,
                  suggestedPrice: s.suggestedPrice?.toString() ?? null,
                }
              : undefined
          }
          manufacturers={manufacturers}
          defaultManufacturerId={sp.manufacturer ?? null}
        />
      </section>
      {s && s._count.nurseryProducts === 0 && <DeleteSupplyForm id={s.id} />}
    </div>
  );
}
