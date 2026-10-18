/**
 * בניית robots.txt ו-sitemap.xml (C-P1-05, אפיון §14.01, §14.04, §22.07). טהור.
 */

export interface RobotsInput {
  /** none = משתלה לא קיימת/מושעית, או סביבת Preview — חסימה מלאה */
  kind: 'root' | 'tenant' | 'none';
  /** origin קנוני (https://...) עבור שורת ה-Sitemap */
  origin?: string;
  /** Preview / סביבה שאינה Production — לעולם לא לאינדוקס */
  preview: boolean;
}

/** נתיבים שאינם לאינדוקס בחנות: ניהול, עגלה, checkout ודפי אישור הזמנה. */
const TENANT_DISALLOW = ['/admin', '/api', '/cart', '/checkout'];

export function buildRobots({ kind, origin, preview }: RobotsInput): string {
  if (preview || kind === 'none') return 'User-agent: *\nDisallow: /\n';
  const lines = ['User-agent: *', 'Allow: /'];
  for (const p of kind === 'root' ? ['/admin', '/api'] : TENANT_DISALLOW) lines.push(`Disallow: ${p}`);
  if (origin) lines.push('', `Sitemap: ${origin}/sitemap.xml`);
  return lines.join('\n') + '\n';
}

export interface SitemapEntry {
  /** נתיב יחסי, למשל /catalog או /product/slug */
  path: string;
  lastModified?: Date | null;
  priority?: number;
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

/** קידוד נתיב (עברית, רווחים) בלי לקודד את ה-/ ואת ה-? וה-= של פרמטרים. */
function encodePath(path: string): string {
  const [pathname, query] = path.split('?');
  const encoded = pathname
    .split('/')
    .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
    .join('/');
  if (!query) return encoded;
  const params = new URLSearchParams(query);
  return `${encoded}?${params.toString()}`;
}

export function buildSitemap(origin: string, entries: SitemapEntry[]): string {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const e of entries) {
    const loc = `${origin}${encodePath(e.path)}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    const parts = [`    <loc>${escapeXml(loc)}</loc>`];
    if (e.lastModified) parts.push(`    <lastmod>${e.lastModified.toISOString()}</lastmod>`);
    if (e.priority !== undefined) parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`);
    urls.push(`  <url>\n${parts.join('\n')}\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
