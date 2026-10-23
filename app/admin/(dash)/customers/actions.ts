'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { addNote, adjustPoints, createGroup, deleteGroup, exportCustomersCsv, parseCrmFilter, setGroupDiscount, updateCrmFields } from '@/lib/crm';
import { isModuleEnabled } from '@/lib/module-access';
import { deleteCustomerData } from '@/lib/customer-privacy';
import { redirect } from 'next/navigation';

export interface CrmState {
  ok?: boolean;
  error?: string;
}

const scope = () => nurseryActionScope({ all: ['crm'] });

export async function updateCustomerAction(_prev: CrmState, fd: FormData): Promise<CrmState> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  const email = String(fd.get('email') || '');
  const r = await updateCrmFields(prisma, s.nurseryId, email, {
    tags: String(fd.get('tags') || ''),
    groupId: String(fd.get('groupId') || '') || null,
    type: String(fd.get('type') || 'PRIVATE'),
    companyName: String(fd.get('companyName') || ''),
    taxId: String(fd.get('taxId') || ''),
  });
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'crm.customer_updated', entityType: 'Customer', metadata: { email } });
  revalidatePath('/admin/customers');
  return { ok: true };
}

export async function addNoteAction(_prev: CrmState, fd: FormData): Promise<CrmState> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  const r = await addNote(prisma, s.nurseryId, String(fd.get('email') || ''), String(fd.get('body') || ''), s.user.email);
  if (!r.ok) return { error: r.error };
  revalidatePath('/admin/customers');
  return { ok: true };
}

export async function groupAction(_prev: CrmState, fd: FormData): Promise<CrmState> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  const op = fd.get('op');
  const r =
    op === 'delete'
      ? await deleteGroup(prisma, s.nurseryId, String(fd.get('id') || ''))
      : op === 'discount'
        ? await setGroupDiscount(prisma, s.nurseryId, String(fd.get('id') || ''), fd.get('discountPct'))
        : await createGroup(prisma, s.nurseryId, String(fd.get('name') || ''), fd.get('discountPct'));
  if (r.ok && op === 'discount') {
    await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'crm.group_discount_changed', entityType: 'CustomerGroup', entityId: String(fd.get('id')), metadata: { discountPct: String(fd.get('discountPct') ?? '') } });
  }
  if (!r.ok) return { error: r.error };
  revalidatePath('/admin/customers');
  return { ok: true };
}

/** R06-06: התאמת נקודות ידנית (מודול מועדון) — נרשמת ביומן הנקודות וב-Audit. */
export async function adjustPointsAction(_prev: CrmState, fd: FormData): Promise<CrmState> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  if (!(await isModuleEnabled(s.nurseryId, 'loyalty'))) return { error: 'מועדון הלקוחות אינו פעיל' };
  const email = String(fd.get('email') || '');
  const points = Number(fd.get('points'));
  const r = await adjustPoints(prisma, s.nurseryId, email, points, String(fd.get('note') || ''), s.user.email);
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'loyalty.points_adjusted', entityType: 'Customer', metadata: { email, points } });
  revalidatePath('/admin/customers');
  return { ok: true };
}

/** R06-09: מחיקת לקוח לבקשתו (גם אורח לפי מייל) — הזמנות נשמרות בלי פרטים אישיים. נרשם ב-Audit. */
export async function deleteCustomerAction(_prev: CrmState, fd: FormData): Promise<CrmState> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  if (fd.get('confirm') !== 'on') return { error: 'יש לסמן אישור — המחיקה סופית' };
  const r = await deleteCustomerData(prisma, s.nurseryId, String(fd.get('email') || ''));
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'privacy.customer_deleted', entityType: 'Customer', metadata: { by: 'nursery', ref: r.ref, anonymizedOrders: r.anonymizedOrders } });
  revalidatePath('/admin/customers');
  redirect('/admin/customers?deleted=1');
}

/** R06-08/09: יצוא לשיווק — רק מי שהסכים לדיוור. כל יצוא נרשם ב-Audit. */
export async function exportCustomersAction(params: Record<string, string>): Promise<{ csv?: string; count?: number; error?: string }> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  const filter = parseCrmFilter(params ?? {});
  const r = await exportCustomersCsv(prisma, s.nurseryId, filter);
  await recordAudit({
    nurseryId: s.nurseryId,
    actorEmail: s.user.email,
    action: 'crm.customers_exported',
    entityType: 'Nursery',
    entityId: s.nurseryId,
    metadata: { count: r.count, filter: { ...filter } },
  });
  return r;
}
