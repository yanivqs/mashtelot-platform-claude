import 'server-only';
import { notFound, permanentRedirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { normalizeRedirectPath } from '@/lib/redirects';
import { findRedirect } from '@/lib/redirects-admin';

/**
 * במקום `notFound()` בדפי החנות: אם יש הפניה לכתובת — הפניה קבועה (308, החלטת בעלים Q5-א;
 * Google מתייחס אליה כמו 301), אחרת 404. נקרא רק כשהדף לא נמצא — אין עלות בגלישה רגילה.
 */
export async function redirectOrNotFound(nurseryId: string, pathname: string): Promise<never> {
  const path = normalizeRedirectPath(pathname);
  if (path) {
    let target: string | null = null;
    try {
      target = await findRedirect(prisma, nurseryId, path);
    } catch (e) {
      console.error('[redirects] חיפוש הפניה נכשל', e);
    }
    if (target && target.split('?')[0] !== path) permanentRedirect(target);
  }
  notFound();
}
