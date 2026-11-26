import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BLEED, renderSign, SIGN_CSS, SIGN_FONT_FILES, SIGN_H, SIGN_W, signFontCss } from './render';
import { fitSignText } from './fit';
import type { SignData } from './types';

/**
 * PDF לדפוס של שלטי צמחים: עמוד לכל שלט, עם גלישה של 3 מ"מ, סימני חיתוך ושורת זיהוי בשוליים
 * (שם הצמח וכמות העותקים — מחוץ לשטח ההדפסה). הרינדור ב-Chromium בשרת, מאותו HTML של התצוגה המקדימה.
 * הגופנים והתמונות מוטמעים (data URL) — הקובץ לא תלוי בשום שרת חיצוני.
 */

/** שוליים סביב הגלישה: סימני חיתוך ושורת זיהוי */
const SLUG = 8;
const PAGE_W = SIGN_W + BLEED * 2 + SLUG * 2;
const PAGE_H = SIGN_H + BLEED * 2 + SLUG * 2;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export interface PdfSign {
  data: SignData;
  quantity: number;
}

async function inlineFonts(): Promise<Record<string, string>> {
  const dir = path.join(process.cwd(), 'public', 'fonts', 'sign');
  const files = SIGN_FONT_FILES.flatMap((f) => [f.latin, ...(f.he ? [f.he] : [])]);
  const out: Record<string, string> = {};
  await Promise.all(
    files.map(async (f) => {
      out[f] = `data:font/woff2;base64,${(await fs.readFile(path.join(dir, f))).toString('base64')}`;
    }),
  );
  return out;
}

/** תמונה → data URL (רק http/https). כשל — null, והשלט יוצא בלי התמונה (נרשם באזהרות). */
async function inlineImage(url: string): Promise<string | null> {
  if (url.startsWith('data:image/')) return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || '').split(';')[0]!.trim();
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** סימני חיתוך בפינות קו החיתוך (מחוץ לגלישה) */
function cropMarks(): string {
  const x0 = SLUG + BLEED;
  const y0 = SLUG + BLEED;
  const x1 = x0 + SIGN_W;
  const y1 = y0 + SIGN_H;
  const len = SLUG - 1.5;
  const lines = [
    [x0, 0.5, x0, 0.5 + len],
    [x1, 0.5, x1, 0.5 + len],
    [x0, PAGE_H - 0.5 - len, x0, PAGE_H - 0.5],
    [x1, PAGE_H - 0.5 - len, x1, PAGE_H - 0.5],
    [0.5, y0, 0.5 + len, y0],
    [0.5, y1, 0.5 + len, y1],
    [PAGE_W - 0.5 - len, y0, PAGE_W - 0.5, y0],
    [PAGE_W - 0.5 - len, y1, PAGE_W - 0.5, y1],
  ];
  return `<svg class="crop" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm" xmlns="http://www.w3.org/2000/svg">${lines
    .map(([a, b, c, d]) => `<path d="M${a} ${b}L${c} ${d}" stroke="#000" stroke-width="0.12"/>`)
    .join('')}</svg>`;
}

export async function signsHtml(signs: PdfSign[], opts: { title: string }): Promise<{ html: string; warnings: string[] }> {
  const fonts = await inlineFonts();
  const warnings: string[] = [];
  const cache = new Map<string, Promise<string | null>>();
  const inline = (url: string | null) => {
    if (!url) return Promise.resolve(null);
    if (!cache.has(url)) cache.set(url, inlineImage(url));
    return cache.get(url)!;
  };
  const pages = await Promise.all(
    signs.map(async (s, i) => {
      const [img, logo] = await Promise.all([inline(s.data.imageUrl), inline(s.data.logoUrl)]);
      if (s.data.imageUrl && !img) warnings.push(`${s.data.hebrewName}: תמונת הצמח לא נטענה`);
      if (s.data.logoUrl && !logo) warnings.push('הלוגו של המשתלה לא נטען');
      const data: SignData = { ...s.data, imageUrl: img, logoUrl: logo };
      const caption = `${s.data.hebrewName} · ${s.quantity} עותקים · ${i + 1}/${signs.length} · ${opts.title}`;
      return `<section class="page">${cropMarks()}<div class="sheet">${renderSign(data, { uid: `s${i}`, bleed: true })}</div><div class="cap">${esc(caption)}</div></section>`;
    }),
  );
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
${signFontCss({ inline: fonts })}
${SIGN_CSS}
@page{size:${PAGE_W}mm ${PAGE_H}mm;margin:0}
html,body{margin:0;padding:0;background:#fff}
.page{position:relative;width:${PAGE_W}mm;height:${PAGE_H}mm;overflow:hidden;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.crop{position:absolute;inset:0}
.sheet{position:absolute;left:${SLUG}mm;top:${SLUG}mm}
.cap{position:absolute;left:${SLUG}mm;right:${SLUG}mm;bottom:2.2mm;text-align:center;font-family:'PS Assistant',sans-serif;font-size:2.4mm;color:#333}
</style></head><body>${pages.join('')}</body></html>`;
  return { html, warnings: [...new Set(warnings)] };
}

type Browser = import('puppeteer-core').Browser;

/** Chromium: CHROMIUM_PATH (פיתוח / בדיקות), או @sparticuz/chromium ב-Vercel */
async function launch(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default;
  const local = process.env.CHROMIUM_PATH;
  if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--font-render-hinting=none'],
    headless: true,
  });
}

export async function renderSignsPdf(signs: PdfSign[], opts: { title: string }): Promise<{ pdf: Buffer; warnings: string[] }> {
  const { html, warnings } = await signsHtml(signs, opts);
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate('document.fonts.ready');
    await page.evaluate(`(${fitSignText.toString()})(document)`);
    const pdf = await page.pdf({
      width: `${PAGE_W}mm`,
      height: `${PAGE_H}mm`,
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 120_000,
    });
    return { pdf: Buffer.from(pdf), warnings };
  } finally {
    await browser.close();
  }
}
