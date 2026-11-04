'use server';

import { revalidatePath } from 'next/cache';
import type { AccessibilityReportStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAudit } from '@/lib/audit';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { parseAccessibilityInfo, REPORT_STATUS_LABELS, updateReportStatus } from '@/lib/accessibility';

export interface InfoState {
  ok?: boolean;
  error?: string;
}

export async function saveAccessibilityInfoAction(_prev: InfoState, fd: FormData): Promise<InfoState> {
  const s = await nurseryActionScope();
  if (!s.ok) return { error: s.error };
  const coordinatorEmail = String(fd.get('coordinatorEmail') || '').trim();
  if (coordinatorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coordinatorEmail)) return { error: 'אימייל הרכז לא תקין' };
  const auditedAt = String(fd.get('auditedAt') || '').trim();
  if (auditedAt && new Date(auditedAt).getTime() > Date.now()) return { error: 'תאריך הבדיקה לא יכול להיות בעתיד' };

  const info = parseAccessibilityInfo({
    coordinatorName: fd.get('coordinatorName'),
    coordinatorPhone: fd.get('coordinatorPhone'),
    coordinatorEmail,
    physicalArrangements: fd.get('physicalArrangements'),
    alternatives: fd.get('alternatives'),
    testedWith: fd.get('testedWith'),
    auditedBy: fd.get('auditedBy'),
    auditedAt,
    buttonSide: fd.get('buttonSide'),
    updatedAt: new Date().toISOString(),
  });
  await prisma.nursery.update({ where: { id: s.nurseryId }, data: { accessibilityInfo: { ...info } } });
  await recordAudit({ nurseryId: s.nurseryId, actorEmail: s.user.email, action: 'accessibility.info_updated', entityType: 'Nursery', entityId: s.nurseryId });
  revalidatePath('/[tenant]', 'layout');
  revalidatePath('/admin/accessibility');
  return { ok: true };
}

const STATUSES: AccessibilityReportStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

export async function updateReportAction(id: string, fd: FormData): Promise<{ error?: string }> {
  const s = await nurseryActionScope();
  if (!s.ok) return { error: s.error };
  const status = String(fd.get('status')) as AccessibilityReportStatus;
  if (!STATUSES.includes(status)) return { error: 'סטטוס לא תקין' };
  if (!(await updateReportStatus(prisma, s.nurseryId, String(id), status, String(fd.get('handlingNote') || '')))) return { error: 'הפנייה לא נמצאה' };
  await recordAudit({
    nurseryId: s.nurseryId,
    actorEmail: s.user.email,
    action: 'accessibility.report_updated',
    entityType: 'AccessibilityReport',
    entityId: String(id),
    metadata: { status: REPORT_STATUS_LABELS[status] },
  });
  revalidatePath('/admin/accessibility');
  revalidatePath('/admin', 'layout');
  return {};
}
