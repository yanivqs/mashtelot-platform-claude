import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { ADMIN } from '../playwright.config';
import { FIX_SHOP } from './global-setup';

const PAGES = ['/', '/catalog', '/product/basil', '/contact', '/cart', '/accessibility'];

test('store pages have no WCAG A/AA violations found by axe, and no CSP violations', async ({ page }) => {
  const csp: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) csp.push(m.text());
  });
  const problems: string[] = [];
  for (const path of PAGES) {
    await page.goto(`${FIX_SHOP}${path}`);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const v of violations) {
      for (const n of v.nodes) {
        const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
        problems.push(`${path} ${v.id}: ${n.target.join(' ')} ${d.fgColor ? `${d.fgColor}/${d.bgColor} ${d.contrastRatio}` : ''}`);
      }
    }
  }
  expect(problems).toEqual([]);
  expect(csp).toEqual([]);
});

test('security headers and statement link', async ({ page, request }) => {
  for (const url of [`${FIX_SHOP}/`, `${ADMIN}/admin/login`]) {
    const h = (await page.goto(url))!.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('camera=()');
  }
  expect(await (await request.get(`${ADMIN}/.well-known/security.txt`)).text()).toContain('Contact: mailto:');

  await page.goto(`${FIX_SHOP}/`);
  await page.getByRole('contentinfo').getByRole('link', { name: 'הצהרת נגישות' }).click();
  await expect(page).toHaveURL(`${FIX_SHOP}/accessibility`);
  await expect(page.getByRole('heading', { name: 'הצהרת נגישות' })).toBeVisible();
});

test('keyboard: the first Tab reveals the skip link, which moves focus to the content', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium');
  await page.goto(`${FIX_SHOP}/catalog`);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'דילוג לתוכן' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
