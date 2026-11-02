'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { ADDONS } from '@/lib/modules';
import { billingDateAfterPayment, parseDateInput } from '@/lib/nursery-billing';

export interface AccountFormState {
  ok?: boolean;
  error?: string;
}

const DESIGN_FLAGS = ['colors', 'hero', 'carousel', 'popup', 'sticky'] as const;

/** סכום מטופס: ריק = 0, ערך לא תקין = null */
function money(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  if (!s) return '0.00';
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n.toFixed(2) : null;
}

function revalidate(nurseryId?: string) {
  revalidatePath('/admin/accounts');
  if (nurseryId) revalidatePath(`/admin/accounts/${nurseryId}`);
  revalidatePath('/admin', 'layout');
}

/** שמירת החשבון: פרטי חיוב, מודולים ועלויות. הכול בטרנזקציה אחת. */
export async function saveAccountAction(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const nurseryId = String(fd.get('nurseryId') || '');
  if (!(await prisma.nursery.count({ where: { id: nurseryId } }))) return { error: 'המשתלה לא נמצאה' };

  const billingType = fd.get('billingType') === 'ONE_TIME' ? 'ONE_TIME' : fd.get('billingType') === 'MONTHLY' ? 'MONTHLY' : null;
  const method = String(fd.get('paymentMethod') || '');
  const paymentMethod = method === 'TRANSFER' || method === 'CASH' || method === 'CARD' ? method : null;
  const validUntil = parseDateInput(fd.get('validUntil'));
  const billingDate = parseDateInput(fd.get('billingDate'));
  if (billingType === 'ONE_TIME' && !validUntil) return { error: 'בחיוב חד פעמי יש למלא "בתוקף עד"' };
  if (billingType === 'MONTHLY' && !billingDate) return { error: 'בחיוב חודשי יש למלא תאריך חיוב' };

  const amountRaw = String(fd.get('amountDue') ?? '').trim();
  const amountDue = amountRaw ? money(amountRaw) : null;
  if (amountRaw && amountDue === null) return { error: 'סכום לתשלום לא תקין' };
  const baseSetupFee = money(fd.get('baseSetupFee'));
  const baseMonthlyFee = money(fd.get('baseMonthlyFee'));
  if (baseSetupFee === null || baseMonthlyFee === null) return { error: 'עלות מערכת הבסיס לא תקינה' };

  const modules = [];
  for (const m of ADDONS) {
    const setupFee = money(fd.get(`setup_${m.key}`));
    const monthlyFee = money(fd.get(`monthly_${m.key}`));
    if (setupFee === null || monthlyFee === null) return { error: `עלות לא תקינה במודול "${m.label}"` };
    const config = m.key === 'design' ? Object.fromEntries(DESIGN_FLAGS.map((f) => [f, fd.get(`design_${f}`) === 'on'])) : null;
    modules.push({ key: m.key, isEnabled: fd.get(`mod_${m.key}`) === 'on', setupFee, monthlyFee, config });
  }
  const on = new Set(modules.filter((m) => m.isEnabled).map((m) => m.key as string));
  for (const m of ADDONS) {
    if (m.requires && on.has(m.key) && !on.has(m.requires)) {
      return { error: `"${m.label}" דורש גם את "${ADDONS.find((x) => x.key === m.requires)!.label}"` };
    }
  }

  const account = {
    joinedAt: parseDateInput(fd.get('joinedAt')),
    billingDate,
    amountDue,
    paymentMethod,
    billingType,
    validUntil: billingType === 'ONE_TIME' ? validUntil : null,
    baseSetupFee,
    baseMonthlyFee,
    notes: String(fd.get('notes') ?? '').trim().slice(0, 2000) || null,
  } as const;
  const salesConfig = { mode: fd.get('sales_mode') === 'QUOTE' ? 'QUOTE' : 'ONLINE' };

  await prisma.$transaction([
    prisma.nurseryAccount.upsert({ where: { nurseryId }, create: { nurseryId, ...account }, update: account }),
    prisma.nurseryModule.upsert({
      where: { nurseryId_moduleKey: { nurseryId, moduleKey: 'sales' } },
      create: { nurseryId, moduleKey: 'sales', isEnabled: true, config: salesConfig },
      update: { config: salesConfig },
    }),
    ...modules.map((m) => {
      const data = {
        isEnabled: m.isEnabled,
        setupFee: m.setupFee,
        monthlyFee: m.monthlyFee,
        ...(m.config ? { config: m.config as Prisma.InputJsonValue } : {}),
      };
      return prisma.nurseryModule.upsert({
        where: { nurseryId_moduleKey: { nurseryId, moduleKey: m.key } },
        create: { nurseryId, moduleKey: m.key, ...data },
        update: data,
      });
    }),
  ]);

  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'account.updated',
    entityType: 'Nursery',
    entityId: nurseryId,
    metadata: { modules: [...on].sort(), billingType, billingDate: fd.get('billingDate') || null, amountDue },
  });
  revalidate(nurseryId);
  return { ok: true };
}

/** "סומן כשולם": בחיוב חודשי התאריך מתקדם לחודש הבא, בחד פעמי תאריך החיוב נסגר. */
export async function markPaidAction(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const nurseryId = String(fd.get('nurseryId') || '');
  const a = await prisma.nurseryAccount.findUnique({ where: { nurseryId } });
  if (!a) return { error: 'קודם שמרו את פרטי החשבון' };
  const next = billingDateAfterPayment(a);
  await prisma.nurseryAccount.update({ where: { nurseryId }, data: { billingDate: next, lastPaidAt: new Date() } });
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'account.paid',
    entityType: 'Nursery',
    entityId: nurseryId,
    metadata: { amount: a.amountDue?.toString() ?? null, method: a.paymentMethod, previousBillingDate: a.billingDate, nextBillingDate: next },
  });
  revalidate(nurseryId);
  return { ok: true };
}

/** השהיית חשבון או חידושו. משפיע על האדמין של המשתלה בלבד; החנות נשארת פתוחה. */
export async function setSuspensionAction(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const nurseryId = String(fd.get('nurseryId') || '');
  if (!(await prisma.nursery.count({ where: { id: nurseryId } }))) return { error: 'המשתלה לא נמצאה' };
  const suspend = fd.get('intent') === 'suspend';
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 500) || null;
  const data = suspend ? { suspendedAt: new Date(), suspendReason: reason } : { suspendedAt: null, suspendReason: null };
  await prisma.nurseryAccount.upsert({ where: { nurseryId }, create: { nurseryId, ...data }, update: data });
  await recordAudit({ nurseryId, actorEmail: user.email, action: suspend ? 'account.suspended' : 'account.resumed', entityType: 'Nursery', entityId: nurseryId, metadata: { reason } });
  revalidate(nurseryId);
  return { ok: true };
}

/** פרטי הקשר שמשתלה חסומה רואה. */
export async function saveContactAction(_prev: AccountFormState, fd: FormData): Promise<AccountFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const data = {
    contactName: String(fd.get('contactName') ?? '').trim().slice(0, 120) || null,
    contactPhone: String(fd.get('contactPhone') ?? '').trim().slice(0, 40) || null,
    contactEmail: String(fd.get('contactEmail') ?? '').trim().slice(0, 200) || null,
  };
  if (data.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) return { error: 'כתובת מייל לא תקינה' };
  await prisma.platformSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data });
  await recordAudit({ actorEmail: user.email, action: 'platform.contact_updated', entityType: 'PlatformSettings', entityId: 'default' });
  revalidate();
  return { ok: true };
}
