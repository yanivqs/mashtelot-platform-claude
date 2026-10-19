import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { redirectOrNotFound } from '@/lib/redirect-resolve';

/**
 * נתיבים עמוקים שאין להם דף (למשל `/shop/roses/red` או `/old/page.html` מהאתר הישן):
 * הפניה קבועה אם הוגדרה (§14.01), אחרת 404.
 */
export const dynamic = 'force-dynamic';

export default async function LegacyPath(props: { params: Promise<{ tenant: string; pageSlug: string; rest: string[] }> }) {
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();
  return redirectOrNotFound(nursery.id, `/${[params.pageSlug, ...params.rest].join('/')}`);
}
