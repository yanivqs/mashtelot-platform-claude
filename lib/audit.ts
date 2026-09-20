import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface RecordAuditParams {
  nurseryId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * רושם רשומת ביקורת (audit) בנקודות רגישות: שינוי מחיר, עדכון מלאי, אישור תשלום וכד'.
 * לעולם לא זורק — כשל בכתיבת ביקורת לא אמור לחסום את הפעולה העסקית עצמה.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        nurseryId: params.nurseryId ?? null,
        actorEmail: params.actorEmail ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  } catch (e) {
    console.error('[audit] כתיבת רשומת ביקורת נכשלה', e);
  }
}
