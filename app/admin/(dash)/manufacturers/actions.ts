'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { refreshStore } from '@/lib/store-refresh';
import { deleteManufacturer, deleteSupply, saveManufacturer, saveSupply } from '@/lib/manufacturers-admin';

export interface AdminFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function revalidate() {
  revalidatePath('/admin/manufacturers', 'layout');
  revalidatePath('/admin/supplies', 'layout');
  revalidatePath('/admin/products/browse');
  refreshStore();
}

const s = (fd: FormData, k: string) => String(fd.get(k) || '').trim();

export async function saveManufacturerAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = s(fd, 'id') || null;
  const res = await saveManufacturer(
    prisma,
    id,
    { name: s(fd, 'name'), logoUrl: s(fd, 'logoUrl') || null, website: s(fd, 'website'), description: s(fd, 'description'), isActive: fd.get('isActive') === 'on' },
    user.email,
  );
  if (!res.ok) return { error: res.error };
  await recordAudit({ actorEmail: user.email, action: id ? 'manufacturer.updated' : 'manufacturer.created', entityType: 'Manufacturer', entityId: res.id ?? id ?? '', metadata: { name: s(fd, 'name') } });
  revalidate();
  if (!id) redirect(`/admin/manufacturers/${res.id}`);
  return { ok: true, message: 'נשמר ✓' };
}

export async function deleteManufacturerAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = s(fd, 'id');
  const res = await deleteManufacturer(prisma, id);
  if (!res.ok) return { error: res.error };
  await recordAudit({ actorEmail: user.email, action: 'manufacturer.deleted', entityType: 'Manufacturer', entityId: id });
  revalidate();
  redirect('/admin/manufacturers');
}

export async function saveSupplyAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = s(fd, 'id') || null;
  const res = await saveSupply(
    prisma,
    id,
    {
      title: s(fd, 'title'),
      manufacturerId: s(fd, 'manufacturerId') || null,
      manufacturerCode: s(fd, 'manufacturerCode'),
      barcode: s(fd, 'barcode'),
      category: s(fd, 'category'),
      description: s(fd, 'description'),
      imageUrl: s(fd, 'imageUrl') || null,
      suggestedPrice: s(fd, 'suggestedPrice'),
    },
    user.email,
  );
  if (!res.ok) return { error: res.error };
  await recordAudit({ actorEmail: user.email, action: id ? 'supply.updated' : 'supply.created', entityType: 'MasterSupply', entityId: res.id ?? id ?? '', metadata: { title: s(fd, 'title') } });
  revalidate();
  if (!id) redirect(`/admin/supplies/${res.id}?created=1`);
  return { ok: true, message: 'נשמר ✓ — משתלות שמשכו את המוצר יקבלו הצעת עדכון אם התוכן השתנה' };
}

export async function deleteSupplyAction(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = s(fd, 'id');
  const res = await deleteSupply(prisma, id);
  if (!res.ok) return { error: res.error };
  await recordAudit({ actorEmail: user.email, action: 'supply.deleted', entityType: 'MasterSupply', entityId: id });
  revalidate();
  redirect('/admin/supplies');
}
