import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { getEnabledModuleKeys } from '@/lib/module-access';
import type { ModuleKey } from '@/lib/modules';
import {
  DENIAL_MESSAGES,
  decideNurseryAccess,
  type AccessDenial,
  type ModuleRequirement,
} from '@/lib/nursery-access';

/**
 * שכבת ההרשאות המרכזית להקשר משתלה (C-P1-01). מחליפה את כל עותקי
 * `resolveNurseryId()` ואת ברירת המחדל "המשתלה הראשונה".
 */

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export interface NurseryScope {
  user: SessionUser;
  nurseryId: string;
}

async function evaluate(req: ModuleRequirement) {
  const user = await getSessionUser();
  const enabled: ReadonlySet<ModuleKey> = user?.nurseryId
    ? await getEnabledModuleKeys(user.nurseryId)
    : new Set<ModuleKey>();
  const decision = decideNurseryAccess(
    user
      ? {
          role: user.role,
          nurseryId: user.nurseryId,
          nurseryActive: user.nursery ? user.nursery.isActive : null,
          disabled: Boolean(user.disabledAt),
        }
      : null,
    enabled,
    req,
  );
  return { user, decision };
}

/** לדפים: מחזיר את ההקשר או מפנה (התחברות / לוח הבקרה עם הסבר). */
export async function requireNurseryPage(req: ModuleRequirement = {}): Promise<NurseryScope> {
  const { user, decision } = await evaluate(req);
  if (!user) redirect('/admin/login');
  if (!decision.ok) redirect(`/admin?notice=${decision.reason}`);
  return { user, nurseryId: decision.nurseryId };
}

export class NurseryAccessError extends Error {
  constructor(readonly reason: AccessDenial) {
    super(DENIAL_MESSAGES[reason]);
  }
}

/** ל-Server Actions: מחזיר את ההקשר או זורק NurseryAccessError (הודעה בעברית). */
export async function requireNurseryAction(req: ModuleRequirement = {}): Promise<NurseryScope> {
  const { user, decision } = await evaluate(req);
  if (!user) throw new NurseryAccessError('NOT_AUTHENTICATED');
  if (!decision.ok) throw new NurseryAccessError(decision.reason);
  return { user, nurseryId: decision.nurseryId };
}

/** ל-Server Actions שמחזירים state לטופס: { error } במקום חריגה. */
export async function nurseryActionScope(
  req: ModuleRequirement = {},
): Promise<({ ok: true } & NurseryScope) | { ok: false; error: string }> {
  try {
    return { ok: true, ...(await requireNurseryAction(req)) };
  } catch (e) {
    if (e instanceof NurseryAccessError) return { ok: false, error: e.message };
    throw e;
  }
}

export function denialMessage(reason: string | undefined): string | null {
  return reason && reason in DENIAL_MESSAGES ? DENIAL_MESSAGES[reason as AccessDenial] : null;
}
