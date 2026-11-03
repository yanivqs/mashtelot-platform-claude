'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { exportSubscribersCsv, removeSubscriber } from '@/lib/newsletter';

const scope = () => nurseryActionScope({ all: ['newsletter'] });

export async function removeSubscriberAction(id: string): Promise<{ error?: string }> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  if (!(await removeSubscriber(prisma, s.nurseryId, String(id)))) return { error: 'הנרשם לא נמצא' };
  await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'newsletter.subscriber_removed', entityType: 'NewsletterSubscriber', entityId: String(id) });
  revalidatePath('/admin/newsletter');
  return {};
}

export async function exportSubscribersAction(): Promise<{ csv?: string; count?: number; error?: string }> {
  const s = await scope();
  if (!s.ok) return { error: s.error };
  const r = await exportSubscribersCsv(prisma, s.nurseryId);
  await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'newsletter.exported', entityType: 'Nursery', entityId: s.nurseryId, metadata: { count: r.count } });
  return r;
}
