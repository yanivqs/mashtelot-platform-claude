import { describe, expect, it } from 'vitest';
import {
  checkRule,
  isLegacyPagePath,
  normalizeRedirectPath,
  normalizeRedirectTarget,
  parseRedirectCsv,
  planRule,
} from './redirects';

describe('normalizeRedirectPath', () => {
  it('takes only the path from a full old-site URL', () => {
    expect(normalizeRedirectPath('https://old-site.co.il/Shop/Roses/?ref=x#top')).toBe('/shop/roses');
  });
  it('decodes, adds leading slash, collapses and trims slashes', () => {
    expect(normalizeRedirectPath('%D7%95%D7%A8%D7%93%D7%99%D7%9D/')).toBe('/ורדים');
    expect(normalizeRedirectPath('//a///b//')).toBe('/a/b');
    expect(normalizeRedirectPath('/')).toBe('/');
  });
  it('rejects empty, whitespace and markup', () => {
    expect(normalizeRedirectPath('')).toBeNull();
    expect(normalizeRedirectPath('/a b')).toBeNull();
    expect(normalizeRedirectPath('/<script>')).toBeNull();
  });
});

describe('normalizeRedirectTarget (no open redirect)', () => {
  it('accepts internal paths with a query', () => {
    expect(normalizeRedirectTarget('/catalog?category=roses')).toBe('/catalog?category=roses');
    expect(normalizeRedirectTarget('/About/')).toBe('/about');
  });
  it('rejects external and protocol-relative targets', () => {
    expect(normalizeRedirectTarget('https://evil.com')).toBeNull();
    expect(normalizeRedirectTarget('//evil.com/x')).toBeNull();
    expect(normalizeRedirectTarget('/\\evil.com')).toBeNull();
    expect(normalizeRedirectTarget('javascript:alert(1)')).toBeNull();
    expect(normalizeRedirectTarget('catalog')).toBeNull();
  });
});

describe('checkRule', () => {
  it('refuses home page source and identical source/target', () => {
    expect(checkRule('/', '/catalog')).toMatchObject({ ok: false });
    expect(checkRule('/about', '/about/')).toMatchObject({ ok: false });
    expect(checkRule('/about.html', '/about')).toEqual({ ok: true, from: '/about.html', to: '/about' });
  });
});

describe('planRule (chains and loops)', () => {
  const existing = [
    { fromPath: '/a', toPath: '/b' },
    { fromPath: '/x', toPath: '/old' },
  ];
  it('follows the target to its final destination', () => {
    expect(planRule('/z', '/a', existing)).toEqual({ from: '/z', to: '/b', retarget: [] });
  });
  it('retargets rules that point to the new source', () => {
    expect(planRule('/old', '/new', existing)).toEqual({ from: '/old', to: '/new', retarget: ['/x'] });
  });
  it('rejects loops', () => {
    expect(planRule('/b', '/a', existing)).toEqual({ error: 'ההפניה יוצרת לולאה' });
  });
  it('updating an existing rule ignores its own old target', () => {
    expect(planRule('/a', '/c', existing)).toEqual({ from: '/a', to: '/c', retarget: [] });
  });
});

describe('parseRedirectCsv', () => {
  it('skips a header, accepts comma/semicolon/tab, reports bad lines', () => {
    const r = parseRedirectCsv('from,to\n/old.html,/about\n"/shop/x";/catalog\n/bad\t//evil.com\n\n/y\t/z');
    expect(r.rows.map((x) => [x.from, x.to])).toEqual([
      ['/old.html', '/about'],
      ['/shop/x', '/catalog'],
      ['/y', '/z'],
    ]);
    expect(r.errors).toEqual([{ line: 4, error: expect.stringContaining('היעד') }]);
  });
});

describe('isLegacyPagePath', () => {
  it('passes old page extensions but not static files', () => {
    expect(isLegacyPagePath('/about.html')).toBe(true);
    expect(isLegacyPagePath('/product.PHP')).toBe(true);
    expect(isLegacyPagePath('/robots.txt')).toBe(false);
    expect(isLegacyPagePath('/logo.png')).toBe(false);
    expect(isLegacyPagePath('/catalog')).toBe(false);
  });
});
