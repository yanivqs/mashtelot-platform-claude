'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { destroySession, getSessionUser } from '@/lib/auth';
import { clientIp } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { loginAuditEvent, LOGIN_ACTIONS } from '@/lib/login';

export async function logout() {
  const user = await getSessionUser();
  if (user) {
    await recordAudit(
      loginAuditEvent(LOGIN_ACTIONS.logout, {
        email: user.email,
        user,
        ctx: { ip: await clientIp(), userAgent: (await headers()).get('user-agent') },
      }),
    );
  }
  await destroySession();
  redirect('/admin/login');
}
