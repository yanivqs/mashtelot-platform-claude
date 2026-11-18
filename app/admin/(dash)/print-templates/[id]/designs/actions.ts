'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { parseTags, saveDesign } from '@/lib/print-catalog-admin';

export interface DesignFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export async function saveDesignAction(_prev: DesignFormState, formData: FormData): Promise<DesignFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const templateId = String(formData.get('templateId') || '');
  const id = String(formData.get('id') || '') || null;
  const s = (k: string) => String(formData.get(k) || '').trim();
  const res = await saveDesign(prisma, templateId, id, {
    code: s('code'),
    title: s('title'),
    imageUrl: s('imageUrl'),
    tags: parseTags(s('tags')),
    sortOrder: Math.trunc(Number(s('sortOrder') || 0)),
    isActive: formData.get('isActive') === 'on',
    nurseryId: s('nurseryId') || null,
  });
  if (!res.ok) return { error: res.error };
  await recordAudit({
    actorEmail: user.email,
    action: id ? 'print.design_updated' : 'print.design_created',
    entityType: 'PrintDesign',
    entityId: res.id ?? id ?? '',
    metadata: { templateId, code: s('code'), nurseryId: s('nurseryId') || null },
  });
  revalidatePath(`/admin/print-templates/${templateId}/designs`);
  revalidatePath('/admin/print-shop', 'layout');
  return { ok: true, message: id ? 'נשמר ✓' : 'הדוגמא נוספה ✓' };
}
