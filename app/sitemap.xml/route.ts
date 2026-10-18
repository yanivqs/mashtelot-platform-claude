import { getNurseryByTenant } from '@/lib/tenant';
import { tenantOrigin } from '@/lib/seo';
import { resolveHost } from '@/lib/tenant-host';
import { buildSitemap } from '@/lib/seo-files';
import { nurserySitemapEntries } from '@/lib/sitemap-data';

/**
 * sitemap.xml לפי הדומיין (C-P1-05, אפיון §14.01). כתובות תמיד לפי ה-origin הקנוני של
 * המשתלה (דומיין מותאם גובר), כך שאין כפילות בין תת-דומיין לדומיין מותאם.
 */
export const dynamic = 'force-dynamic';

const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost:3000';
const HEADERS = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' };

export async function GET(request: Request) {
  const target = resolveHost(request.headers.get('host'), ROOT_DOMAIN);

  if (target.kind === 'root') {
    const protocol = ROOT_DOMAIN.startsWith('localhost') ? 'http' : 'https';
    return new Response(buildSitemap(`${protocol}://${ROOT_DOMAIN}`, [{ path: '/', priority: 1 }]), { headers: HEADERS });
  }
  if (target.kind !== 'tenant') return new Response('Not found', { status: 404 });

  const nursery = await getNurseryByTenant(target.tenant);
  if (!nursery) return new Response('Not found', { status: 404 });

  const xml = buildSitemap(tenantOrigin(nursery), await nurserySitemapEntries(nursery.id));
  return new Response(xml, { headers: HEADERS });
}
