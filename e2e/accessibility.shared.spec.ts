import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { ADMIN } from '../playwright.config';
import { A11Y_SHOP, E2E_A11Y_OWNER } from './global-setup';
import { A11Y_STORAGE_KEY } from '../lib/a11y-settings';

const PAGES = ['/', '/catalog', '/catalog?q=%D7%91%D7%96%D7%99%D7%9C%D7%99%D7%A7%D7%95%D7%9D', '/product/basil', '/contact', '/cart', '/accessibility'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** ההגדרות נכתבות לפני טעינת הדף, כמו אצל גולש שכבר בחר. */
async function withSettings(page: Page, settings: Record<string, unknown>) {
  await page.addInitScript(
    ([key, value]) => {
      // רק בטעינה הראשונה, אחרת כל ניווט היה מוחק את מה שהגולש בחר. הפופאפ נחשב כסגור
      if (localStorage.getItem(key as string) === null && !sessionStorage.getItem('seeded')) localStorage.setItem(key as string, value as string);
      sessionStorage.setItem('seeded', '1');
      const getItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (k: string) {
        return k.startsWith('promo-dismissed:') ? '1' : getItem.call(this, k);
      };
    },
    [A11Y_STORAGE_KEY, JSON.stringify(settings)],
  );
}

async function axeProblems(page: Page, label: string): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.flatMap((v) =>
    v.nodes.map((n) => {
      const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
      return `${label} ${v.id}: ${n.target.join(' ')} ${d.fgColor ? `${d.fgColor}/${d.bgColor} ${d.contrastRatio}` : ''}`;
    }),
  );
}

const dismissPopup = async (page: Page) => {
  const popup = page.getByRole('dialog', { name: 'מבצע נגיש' });
  await popup.waitFor({ state: 'visible', timeout: 5000 });
  await popup.getByRole('button', { name: 'הבנתי' }).click();
};

test.describe('accessibility menu', () => {
  test('opens by button and shortcut, keeps focus inside, Esc closes and returns focus', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium');
    await withSettings(page, {});
    await page.goto(`${A11Y_SHOP}/contact`);
    // מקלדת: אחרי קישור הדילוג, התפריט הוא העצירה הבאה
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'דילוג לתוכן' })).toBeFocused();
    await page.keyboard.press('Tab');
    const opener = page.getByTestId('a11y-open');
    await expect(opener).toBeFocused();

    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'תפריט נגישות' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'סגירת תפריט הנגישות' })).toBeFocused();
    // חלון מודאלי: Tab לא בורח לדף שמאחוריו
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main, header, footer')))).toBe(false);
    }

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();

    await page.keyboard.press('Control+F10');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('the open menu and every contrast mode pass axe', async ({ page }) => {
    test.setTimeout(120000);
    const problems: string[] = [];
    await withSettings(page, {});
    await page.goto(`${A11Y_SHOP}/contact`);
    await page.getByTestId('a11y-open').click();
    await expect(page.getByRole('dialog', { name: 'תפריט נגישות' })).toBeVisible();
    problems.push(...(await axeProblems(page, 'open-menu')));
    await page.keyboard.press('Escape');
    for (const contrast of ['dark', 'light']) {
      await page.addInitScript(([key, value]) => localStorage.setItem(key as string, value as string), [A11Y_STORAGE_KEY, JSON.stringify({ contrast })]);
      for (const path of PAGES) {
        await page.goto(`${A11Y_SHOP}${path}`);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('html')).toHaveAttribute('data-a11y-contrast', contrast);
        problems.push(...(await axeProblems(page, `${contrast} ${path}`)));
      }
    }
    expect(problems).toEqual([]);
  });

  test('store pages with a carousel, popup and checkout pass axe', async ({ page }) => {
    test.setTimeout(120000);
    const problems: string[] = [];
    await page.goto(`${A11Y_SHOP}/`);
    await expect(page.getByRole('dialog', { name: 'מבצע נגיש' })).toBeVisible();
    problems.push(...(await axeProblems(page, 'popup')));
    await dismissPopup(page);
    for (const path of PAGES) {
      await page.goto(`${A11Y_SHOP}${path}`);
      await page.waitForLoadState('networkidle');
      problems.push(...(await axeProblems(page, path)));
    }
    await page.goto(`${A11Y_SHOP}/product/basil`);
    await page.getByRole('button', { name: 'הוסף לעגלה' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'נוסף לעגלה' })).toBeAttached();
    for (const path of ['/cart', '/checkout']) {
      await page.goto(`${A11Y_SHOP}${path}`);
      await page.waitForLoadState('networkidle');
      problems.push(...(await axeProblems(page, `with-item ${path}`)));
    }
    expect(problems).toEqual([]);
  });

  test('no horizontal scroll at text size 200%, with the widest settings too', async ({ page }) => {
    test.setTimeout(120000);
    await withSettings(page, { text: 3, spacing: 1, lineheight: 1, targets: true });
    const wide: string[] = [];
    for (const path of PAGES) {
      await page.goto(`${A11Y_SHOP}${path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-a11y-text', '3');
      const overflow = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        const excess = document.documentElement.scrollWidth - width;
        if (excess <= 1) return null;
        // מי גורם לגלישה: רכיבים שחורגים מהמסך ולא נמצאים בתוך אזור גלילה משלהם
        const clipped = (el: Element) => {
          for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX)) return true;
          return false;
        };
        // הרכיבים העמוקים ביותר שחורגים בתוך התוכן הם הגורם; ההורים שלהם רק נמתחים אחריהם
        const out = (el: Element) => {
          const r = el.getBoundingClientRect();
          return r.width > 1 && getComputedStyle(el).position !== 'fixed' && !clipped(el) && (r.left < -1 || r.right > width + 1);
        };
        const culprits = [...document.querySelectorAll('main *')]
          .filter((el) => out(el) && ![...el.children].some(out))
          .slice(0, 12)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class')).slice(0, 80)} [${(el.textContent ?? '').slice(0, 20)}] w=${Math.round(el.getBoundingClientRect().width)}`);
        return `${excess}px ${culprits.join(' | ')}`;
      });
      if (overflow) wide.push(`${path}: ${overflow}`);
    }
    expect(wide).toEqual([]);
  });

  test('the wide categories menu stays on screen and causes no horizontal scroll on desktop', async ({ page }) => {
    await withSettings(page, {});
    for (const width of [768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${A11Y_SHOP}/contact`);
      const excess = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(excess, `גלישה ברוחב ${width}`).toBeLessThanOrEqual(0);
      // פתוח: בפוקוס מקלדת, כל הפאנל בתוך המסך
      const trigger = page.locator('header nav').getByRole('link', { name: 'קטגוריות' });
      await trigger.focus();
      const child = page.locator('header nav').getByRole('link', { name: 'עלים' });
      await expect(child).toBeVisible();
      const box = await child.locator('xpath=ancestor::div[contains(@class,"max-h-")][1]').boundingBox();
      expect(box!.x, `שמאל ברוחב ${width}`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `ימין ברוחב ${width}`).toBeLessThanOrEqual(width);
    }
  });

  test('settings apply before hydration, survive reload and navigation, and reset clears them', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await withSettings(page, {});
    await page.goto(`${A11Y_SHOP}/contact`);
    await page.getByTestId('a11y-open').click();
    const panel = page.getByRole('dialog', { name: 'תפריט נגישות' });
    await panel.getByRole('button', { name: 'ניגודיות כהה' }).click();
    await expect(panel.getByRole('button', { name: 'ניגודיות כהה' })).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: /גודל טקסט: רגיל/ }).click();
    await expect(panel.getByRole('button', { name: /גודל טקסט: 125%/ })).toBeVisible();
    await expect(panel.getByRole('status')).toContainText('גודל טקסט: 125%');
    await expect(page.locator('html')).toHaveAttribute('data-a11y-contrast', 'dark');
    expect(await page.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(0, 0, 0)');
    // התפריט עצמו לא נצבע, כדי שתמיד אפשר יהיה לקרוא אותו ולבטל
    expect(await panel.evaluate((p) => getComputedStyle(p).backgroundColor)).toBe('rgb(255, 255, 255)');
    await page.keyboard.press('Escape');

    // הסקריפט המוקדם מוחל גם כש-JS של האפליקציה חסום: הדף נטען בלי הבהוב של העיצוב הרגיל
    const stored = await page.evaluate((key) => localStorage.getItem(key), A11Y_STORAGE_KEY);
    const noApp = await page.context().newPage();
    await noApp.route('**/_next/static/chunks/**', (r) => r.abort());
    await noApp.addInitScript(([key, value]) => localStorage.setItem(key as string, value as string), [A11Y_STORAGE_KEY, stored as string]);
    await noApp.goto(`${A11Y_SHOP}/contact`, { waitUntil: 'domcontentloaded' });
    await expect(noApp.locator('html')).toHaveAttribute('data-a11y-contrast', 'dark');
    await noApp.close();

    await page.goto(`${A11Y_SHOP}/catalog`);
    await expect(page.locator('html')).toHaveAttribute('data-a11y-text', '1');
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);

    await page.getByTestId('a11y-open').click();
    await panel.getByRole('button', { name: 'ביטול כל ההתאמות' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-a11y-contrast', /./);
    await expect(page.locator('html')).not.toHaveAttribute('data-a11y-text', /./);
    expect(await page.evaluate((key) => localStorage.getItem(key), A11Y_STORAGE_KEY)).toBeNull();
  });

  test('profile, page structure and color filter keep the page working', async ({ page }) => {
    await withSettings(page, {});
    await page.goto(`${A11Y_SHOP}/contact`);
    await page.getByTestId('a11y-open').click();
    const panel = page.getByRole('dialog', { name: 'תפריט נגישות' });

    await panel.getByRole('button', { name: /דיסלקציה/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-a11y-font', '1');
    await expect(page.locator('html')).toHaveAttribute('data-a11y-align', '1');
    await panel.getByRole('button', { name: /דיסלקציה/ }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-a11y-font', /./);

    await panel.getByRole('button', { name: 'שחור ולבן' }).click();
    expect(await page.locator('html').evaluate((h) => getComputedStyle(h).filter)).toBe('grayscale(1)');
    await panel.getByRole('button', { name: 'עצירת תנועה', exact: true }).click();
    expect(await page.locator('main').evaluate((m) => getComputedStyle(m).transitionDuration)).toBe('0s');

    await panel.getByRole('button', { name: 'מבנה העמוד' }).click();
    const heading = await page.locator('main h1').first().innerText();
    await panel.getByTestId('a11y-structure').getByRole('button', { name: `כותרת רמה 1: ${heading}` }).click();
    await expect(panel).toBeHidden();
    await expect(page.locator('main h1').first()).toBeFocused();

    await page.getByTestId('a11y-open').click();
    await panel.getByRole('button', { name: 'ביטול כל ההתאמות' }).click();
    await panel.getByRole('button', { name: 'סרגל קריאה' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.a11y-guide-line')).toBeAttached();
  });

  test('the carousel can be stopped and started', async ({ page }) => {
    await page.goto(`${A11Y_SHOP}/`);
    await dismissPopup(page);
    await page.getByRole('button', { name: 'עצירת המעבר האוטומטי' }).click();
    await expect(page.getByRole('button', { name: 'הפעלת המעבר האוטומטי' })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1500);
    await expect(page.getByRole('group', { name: '1 מתוך 2' })).toHaveAttribute('aria-hidden', 'false');
  });

  test('the promo popup holds focus and Esc closes it for good', async ({ page }) => {
    await page.goto(`${A11Y_SHOP}/contact`);
    const popup = page.getByRole('dialog', { name: 'מבצע נגיש' });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('button', { name: 'סגירה' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(popup).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(1600);
    await expect(popup).toHaveCount(0);
  });
});

test.describe('statement and reports', () => {
  test('a visitor reports a problem; the owner sees the deadline, resolves it and fills the statement', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium' || testInfo.project.name !== 'desktop');
    await withSettings(page, {});
    await page.goto(`${A11Y_SHOP}/contact`);
    await page.getByTestId('a11y-open').click();
    await page.getByRole('dialog', { name: 'תפריט נגישות' }).getByRole('link', { name: 'דיווח על בעיית נגישות' }).click();
    await expect(page).toHaveURL(`${A11Y_SHOP}/accessibility#report`);

    const form = page.locator('#report');
    const description = 'הכפתור בעגלה לא נקרא בקורא מסך';
    await form.getByLabel('מה הבעיה? (חובה)').fill(description);
    await form.getByRole('button', { name: 'שליחת הדיווח' }).click();
    await expect(form.getByRole('alert')).toContainText('אימייל או טלפון');
    await expect(form.getByLabel('מה הבעיה? (חובה)')).toHaveValue(description);
    await form.getByLabel('אימייל').fill('reporter@e2e.invalid');
    await form.getByRole('button', { name: 'שליחת הדיווח' }).click();
    await expect(form.getByRole('status')).toContainText('הפנייה התקבלה');

    await page.goto(`${ADMIN}/admin/login`);
    await page.locator('input[name="email"]').fill(E2E_A11Y_OWNER.email);
    await page.locator('input[name="password"]').fill(E2E_A11Y_OWNER.password);
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page).toHaveURL(`${ADMIN}/admin`);
    await page.getByRole('link', { name: 'נגישות (1)' }).click();

    const report = page.getByTestId('a11y-report').filter({ hasText: description });
    await expect(report.getByTestId('a11y-report-deadline')).toContainText('60');
    await report.getByLabel('סטטוס').selectOption('RESOLVED');
    await report.getByRole('button', { name: 'עדכון' }).click();
    await expect(page.getByRole('link', { name: 'נגישות', exact: true })).toBeVisible();

    await page.getByLabel('שם', { exact: true }).fill('דנה לוי');
    await page.getByLabel('הסדרי הנגישות במשתלה עצמה').fill('חניית נכים בכניסה');
    await page.getByRole('button', { name: 'שמירה', exact: true }).click();
    await expect(page.getByTestId('a11y-info-saved')).toBeVisible();

    await page.goto(`${A11Y_SHOP}/accessibility`);
    await expect(page.getByText('רכז/ת נגישות: דנה לוי')).toBeVisible();
    await expect(page.getByText('חניית נכים בכניסה')).toBeVisible();
    // בלי בדיקה ידנית, ההצהרה ממשיכה לומר זאת בגלוי
    await expect(page.getByText('טרם עבר בדיקה ידנית מלאה')).toBeVisible();
  });
});
