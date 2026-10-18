import { describe, expect, it } from 'vitest';
import { buildRobots, buildSitemap } from './seo-files';
import { resolveHost } from './tenant-host';

describe('resolveHost', () => {
  const R = 'mashtelot.net';
  it('identifies the root domain, platform subdomains and custom domains', () => {
    expect(resolveHost('mashtelot.net', R)).toEqual({ kind: 'root' });
    expect(resolveHost('www.mashtelot.net', R)).toEqual({ kind: 'root' });
    expect(resolveHost('demo-nursery.mashtelot.net', R)).toEqual({ kind: 'tenant', tenant: 'demo-nursery' });
    expect(resolveHost('WWW.Galim-Nursery.co.il', R)).toEqual({ kind: 'tenant', tenant: 'galim-nursery.co.il' });
    expect(resolveHost('', R)).toEqual({ kind: 'none' });
  });
});

describe('buildRobots', () => {
  it('blocks everything on preview and for unknown/suspended stores', () => {
    expect(buildRobots({ kind: 'tenant', origin: 'https://x', preview: true })).toBe('User-agent: *\nDisallow: /\n');
    expect(buildRobots({ kind: 'none', preview: false })).toBe('User-agent: *\nDisallow: /\n');
  });

  it('store: allows the site, hides admin/cart/checkout, points to its own sitemap', () => {
    const r = buildRobots({ kind: 'tenant', origin: 'https://demo.mashtelot.net', preview: false });
    expect(r).toContain('Allow: /');
    for (const p of ['/admin', '/cart', '/checkout']) expect(r).toContain(`Disallow: ${p}`);
    expect(r).toContain('Sitemap: https://demo.mashtelot.net/sitemap.xml');
  });
});

describe('buildSitemap', () => {
  it('encodes Hebrew paths, escapes XML, keeps query params and de-duplicates', () => {
    const xml = buildSitemap('https://demo.mashtelot.net', [
      { path: '/', priority: 1 },
      { path: '/product/ורד-אדום--abc', lastModified: new Date('2026-10-01T00:00:00Z') },
      { path: '/catalog?category=עצים' },
      { path: '/catalog?category=עצים' },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(3);
    expect(xml).toContain('<loc>https://demo.mashtelot.net/product/%D7%95%D7%A8%D7%93-%D7%90%D7%93%D7%95%D7%9D--abc</loc>');
    expect(xml).toContain('<loc>https://demo.mashtelot.net/catalog?category=%D7%A2%D7%A6%D7%99%D7%9D</loc>');
    expect(xml).toContain('<lastmod>2026-10-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('escapes XML special characters', () => {
    expect(buildSitemap('https://x', [{ path: '/a&b' }])).toContain('https://x/a%26b');
  });
});
