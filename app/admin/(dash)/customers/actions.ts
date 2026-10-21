'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { addNote, createGroup, deleteGroup, exportCustomersCsv, parseCrmFilter, updateCrmFields } from '@/lib/crm';

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
  const r =
    fd.get('op') === 'delete'
      ? await deleteGroup(prisma, s.nurseryId, String(fd.get('id') || ''))
      : await createGroup(prisma, s.nurseryId, String(fd.get('name') || ''));
  if (!r.ok) return { error: r.error };
  revalidatePath('/admin/customers');
  return { ok: true };
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
