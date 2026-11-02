import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { accountStatus, billingDateAfterPayment, dateInputValue, formatAccountDate } from '@/lib/nursery-billing';
import { ADDONS, defaultConfigFor, type AddonModuleKey } from '@/lib/modules';
import { AccountForm, MarkPaidForm, SuspensionForm, type ModuleRowVM } from '../forms';
import { AccountBadge } from '../badge';

export const dynamic = 'force-dynamic';

export default async function NurseryAccountPage(props: { params: Promise<{ id: string }> }) {
  await requireUser(['SUPER_ADMIN']);
  const { id } = await props.params;
  const n = await prisma.nursery.findUnique({ where: { id }, include: { account: true, modules: true } });
  if (!n) notFound();
  const a = n.account;
  const byKey = new Map(n.modules.map((m) => [m.moduleKey, m]));

  const modules: Record<string, ModuleRowVM> = {};
  for (const m of ADDONS) {
    const row = byKey.get(m.key);
    modules[m.key] = {
      enabled: row?.isEnabled ?? false,
      setupFee: row ? row.setupFee.toString() : '0',
      monthlyFee: row ? row.monthlyFee.toString() : '0',
      config: { ...defaultConfigFor(m.key as AddonModuleKey), ...((row?.config as Record<string, unknown> | null) ?? {}) },
    };
  }
  const next = a ? billingDateAfterPayment(a) : null;
  const salesConfig = (byKey.get('sales')?.config as { mode?: string } | null) ?? null;

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/accounts" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowRight className="h-4 w-4" />
        לכל החשבונות
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{n.name}</h1>
        <AccountBadge status={accountStatus(a)} />
      </div>
      {a?.lastPaidAt && <p className="text-sm text-gray-600">תשלום אחרון נרשם ב-{formatAccountDate(a.lastPaidAt)}</p>}

      <AccountForm
        a={{
          nurseryId: n.id,
          joinedAt: dateInputValue(a?.joinedAt ?? n.createdAt),
          billingDate: dateInputValue(a?.billingDate),
          amountDue: a?.amountDue?.toString() ?? '',
          paymentMethod: a?.paymentMethod ?? '',
          billingType: a?.billingType ?? '',
          validUntil: dateInputValue(a?.validUntil),
          baseSetupFee: a?.baseSetupFee.toString() ?? '0',
          baseMonthlyFee: a?.baseMonthlyFee.toString() ?? '0',
          notes: a?.notes ?? '',
          salesMode: salesConfig?.mode === 'QUOTE' ? 'QUOTE' : 'ONLINE',
          modules,
        }}
      />

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">תשלום</h2>
        <MarkPaidForm
          nurseryId={n.id}
          nextText={a?.billingType === 'MONTHLY' ? `תאריך החיוב הבא יהיה ${formatAccountDate(next)}` : 'תאריך החיוב ייסגר'}
        />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">השהיית חשבון</h2>
        <SuspensionForm nurseryId={n.id} suspended={Boolean(a?.suspendedAt)} reason={a?.suspendReason ?? null} />
      </section>
    </div>
  );
}
