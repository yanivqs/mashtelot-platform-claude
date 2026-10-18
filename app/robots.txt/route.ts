import { getNurseryByTenant } from '@/lib/tenant';
import { tenantOrigin } from '@/lib/seo';
import { resolveHost } from '@/lib/tenant-host';
import { buildRobots } from '@/lib/seo-files';

/**
 * robots.txt לפי הדומיין (C-P1-05). Preview וכל סביבה שאינה Production — חסימה מלאה
 * (אפיון §14.04, §22.07). משתלה לא קיימת/מושעית — חסימה מלאה.
 */
export const dynamic = 'force-dynamic';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost:3000';

export async function GET(request: Request) {
  const preview = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== 'production';
  const target = resolveHost(request.headers.get('host'), ROOT_DOMAIN);

  let body: string;
  if (target.kind === 'root') {
    const protocol = ROOT_DOMAIN.startsWith('localhost') ? 'http' : 'https';
    body = buildRobots({ kind: 'root', preview, origin: `${protocol}://${ROOT_DOMAIN}` });
  } else if (target.kind === 'tenant') {
    const nursery = await getNurseryByTenant(target.tenant);
    body = nursery
      ? buildRobots({ kind: 'tenant', preview, origin: tenantOrigin(nursery) })
      : buildRobots({ kind: 'none', preview });
  } else {
    body = buildRobots({ kind: 'none', preview });
  }

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
