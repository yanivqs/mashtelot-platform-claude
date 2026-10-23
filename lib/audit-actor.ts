import 'server-only';
import { getSessionUser } from '@/lib/auth';
import { recordAudit, type RecordAuditParams } from '@/lib/audit';

/**
 * §20.02: רשומת Audit עם המשתמש המחובר כמבצע (ה-session כבר במטמון של הבקשה).
 * לפעולות שמקבלות רק מזהה משתלה ולא את המשתמש. לעולם לא זורק (כמו recordAudit).
 */
export async function auditAsCurrentUser(params: Omit<RecordAuditParams, 'actorEmail'>): Promise<void> {
  const user = await getSessionUser().catch(() => null);
  await recordAudit({ ...params, actorEmail: user?.email ?? null });
}
