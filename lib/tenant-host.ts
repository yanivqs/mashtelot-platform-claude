/**
 * זיהוי המשתלה לפי ה-Host (טהור; משותף ל-middleware ולמסלולי robots/sitemap).
 * - הדומיין הראשי (או www.) → root
 * - תת-דומיין של הפלטפורמה: galim.mashtelot.net → "galim"
 * - כל דומיין אחר → דומיין מותאם: www.galim-nursery.co.il → "galim-nursery.co.il"
 */
export type HostTarget = { kind: 'root' } | { kind: 'tenant'; tenant: string } | { kind: 'none' };

export function resolveHost(rawHost: string | null | undefined, rootDomain: string): HostTarget {
  const host = (rawHost || '').toLowerCase().trim();
  const root = rootDomain.toLowerCase();
  if (!host) return { kind: 'none' };
  if (host === root || host === `www.${root}`) return { kind: 'root' };

  const tenant = host.endsWith(`.${root}`)
    ? host.slice(0, -1 * (root.length + 1)).replace(/^www\./, '')
    : host.replace(/^www\./, '');
  return tenant ? { kind: 'tenant', tenant } : { kind: 'none' };
}
