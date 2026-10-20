'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { addMember, resetMemberPassword, setMemberDisabled, setMemberRole } from '@/lib/nursery-team';

export interface TeamState {
  ok?: boolean;
  error?: string;
  /** UX-01: ערכים שנשלחו (React 19 מאפס את הטופס) — בלי הסיסמה */
  values?: { email?: string; fullName?: string; role?: string };
}

/** בעל המשתלה בלבד (תחום owner). */
const ownerScope = () => nurseryActionScope({ area: 'owner' });

export async function addMemberAction(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const scope = await ownerScope();
  if (!scope.ok) return { error: scope.error };
  const values = { email: String(fd.get('email') || ''), fullName: String(fd.get('fullName') || ''), role: String(fd.get('role') || '') };
  const r = await addMember(prisma, scope.nurseryId, { ...values, password: String(fd.get('password') || '') });
  if (!r.ok) return { error: r.error, values };
  await recordAudit({
    nurseryId: scope.nurseryId,
    actorEmail: scope.user.email,
    action: 'team.member_added',
    entityType: 'User',
    entityId: r.userId,
    metadata: { email: values.email.trim().toLowerCase(), role: values.role },
  });
  revalidatePath('/admin/team');
  return { ok: true };
}

export async function memberAction(_prev: TeamState, fd: FormData): Promise<TeamState> {
  const scope = await ownerScope();
  if (!scope.ok) return { error: scope.error };
  const userId = String(fd.get('userId') || '');
  const op = String(fd.get('op') || '');
  let r: { ok: boolean; error?: string; email?: string };
  let action: string;
  let metadata: Record<string, unknown> = {};
  if (op === 'role') {
    const role = String(fd.get('role') || '');
    r = await setMemberRole(prisma, scope.nurseryId, userId, role);
    action = 'team.member_role_changed';
    metadata = { role };
  } else if (op === 'password') {
    r = await resetMemberPassword(prisma, scope.nurseryId, userId, String(fd.get('password') || ''));
    action = 'team.member_password_reset';
  } else if (op === 'disable' || op === 'enable') {
    r = await setMemberDisabled(prisma, scope.nurseryId, userId, op === 'disable');
    action = op === 'disable' ? 'team.member_disabled' : 'team.member_enabled';
  } else {
    return { error: 'פעולה לא מוכרת' };
  }
  if (!r.ok) return { error: r.error };
  await recordAudit({ nurseryId: scope.nurseryId, actorEmail: scope.user.email, action, entityType: 'User', entityId: userId, metadata: { email: r.email, ...metadata } });
  revalidatePath('/admin/team');
  return { ok: true };
}
