import type { SignData, SignSocial } from './types';
import { qrPath } from './qr';

/**
 * שלט צמח 15×10 ס"מ: HTML + SVG טהור (מחרוזת), כדי שהתצוגה המקדימה בדפדפן וה-PDF בשרת ייראו זהה.
 * כל המידות במ"מ, ביחס לקו החיתוך (150×100). בהפקה לדפוס נוספת גלישה של 3 מ"מ מכל צד.
 * הטקסטים מוקטנים אוטומטית לתיבה שלהם (fit.ts), בין גודל מקסימלי למינימלי.
 */

export const SIGN_W = 150;
export const SIGN_H = 100;
export const BLEED = 3;

const C = {
  paper: '#f7f2e8',
  paperLight: '#fcf9f3',
  ink: '#1d3a26',
  frame: '#2f5236',
  leaf: '#5f8752',
  latin: '#587a48',
  text: '#2e2e2a',
  muted: '#55554e',
  gold: '#cdbd93',
  line: '#d3cbb4',
  sun: '#f2b233',
  sunStroke: '#dd9d1c',
  sunOff: '#e8dcbc',
  drop: '#1f4e79',
  dropOff: '#9fb4c8',
  cardBorder: '#cfd6c2',
  lightCard: '#fcf5e1',
  lightBorder: '#e8d28f',
};

const HE_RANGE = 'U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F';
const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

export const SIGN_FONT_FILES = [
  { family: 'PS Heebo', weight: 800, style: 'normal', he: 'heebo-hebrew-800-normal.woff2', latin: 'heebo-latin-800-normal.woff2' },
  { family: 'PS Heebo', weight: 700, style: 'normal', he: 'heebo-hebrew-700-normal.woff2', latin: 'heebo-latin-700-normal.woff2' },
  {
    family: 'PS Assistant',
    weight: 400,
    style: 'normal',
    he: 'assistant-hebrew-400-normal.woff2',
    latin: 'assistant-latin-400-normal.woff2',
  },
  {
    family: 'PS Assistant',
    weight: 600,
    style: 'normal',
    he: 'assistant-hebrew-600-normal.woff2',
    latin: 'assistant-latin-600-normal.woff2',
  },
  {
    family: 'PS Assistant',
    weight: 700,
    style: 'normal',
    he: 'assistant-hebrew-700-normal.woff2',
    latin: 'assistant-latin-700-normal.woff2',
  },
  { family: 'PS Lato', weight: 400, style: 'italic', he: null, latin: 'lato-latin-400-italic.woff2' },
] as const;

/** מקור הגופנים: תיקייה ציבורית (דפדפן) או מפה של שם קובץ → data URL (PDF בשרת) */
export type FontSource = { base: string } | { inline: Record<string, string> };

export function signFontCss(src: FontSource): string {
  const url = (file: string) => ('base' in src ? `${src.base}/${file}` : src.inline[file]);
  const face = (family: string, weight: number, style: string, file: string, range: string) =>
    `@font-face{font-family:'${family}';src:url(${url(file)}) format('woff2');font-weight:${weight};font-style:${style};font-display:block;unicode-range:${range}}`;
  return SIGN_FONT_FILES.flatMap((f) => [
    ...(f.he ? [face(f.family, f.weight, f.style, f.he, HE_RANGE)] : []),
    face(f.family, f.weight, f.style, f.latin, LATIN_RANGE),
  ]).join('\n');
}

/** CSS של השלט (ללא גופנים). כל המחלקות בקידומת ps- כדי לא להתנגש בדף המארח. */
export const SIGN_CSS = `
.ps-sheet{position:relative;overflow:hidden;background:${C.paper};direction:rtl;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.ps-sheet *{box-sizing:border-box;margin:0;padding:0}
.ps-svg{position:absolute;inset:0;display:block}
.ps-layer{position:absolute}
.ps-box{position:absolute;display:flex;align-items:center;justify-content:center;overflow:hidden;text-align:center}
.ps-in{display:block;width:100%}
.ps-title{font-family:'PS Heebo',sans-serif;font-weight:800;color:${C.ink};line-height:1.08;letter-spacing:-0.01em}
.ps-latin{font-family:'PS Lato',serif;font-style:italic;font-weight:400;color:${C.latin};line-height:1.15;letter-spacing:.015em;direction:ltr}
.ps-desc{font-family:'PS Assistant',sans-serif;font-weight:400;color:${C.text};line-height:1.42}
.ps-h{font-family:'PS Heebo',sans-serif;font-weight:700;color:${C.ink};line-height:1.1}
.ps-label{font-family:'PS Assistant',sans-serif;font-weight:700;color:${C.ink};line-height:1.15}
.ps-note{font-family:'PS Assistant',sans-serif;font-weight:400;color:${C.muted};line-height:1.3}
.ps-small{font-family:'PS Assistant',sans-serif;font-weight:400;color:${C.text};line-height:1.25}
.ps-scan{font-family:'PS Assistant',sans-serif;color:${C.ink};line-height:1.2}
.ps-scan b{font-weight:700;display:block;margin-bottom:.4mm}
.ps-logo{position:absolute;object-fit:contain;object-position:center}
.ps-wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:'PS Heebo',sans-serif;font-weight:800;font-size:16mm;color:rgba(29,58,38,.07);transform:rotate(-18deg);white-space:nowrap}
`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => Math.round(v * 1000) / 1000;

/** תיבת טקסט שמוקטנת אוטומטית: מיקום במ"מ, גודל גופן מקסימלי ומינימלי במ"מ */
function box(cls: string, x: number, y: number, w: number, h: number, max: number, min: number, html: string, extra = ''): string {
  return `<div class="ps-box" data-fit="1" data-max="${max}" data-min="${min}" style="left:${n(x)}mm;top:${n(y)}mm;width:${n(w)}mm;height:${n(h)}mm;${extra}"><div class="ps-in ${cls}" style="font-size:${max}mm">${html}</div></div>`;
}

// ---------- איורים (יחידות SVG = מ"מ) ----------

function sunRays(cx: number, cy: number, r1: number, r2: number, stroke: string, width: number): string {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    d += `M${n(cx + Math.cos(a) * r1)} ${n(cy + Math.sin(a) * r1)}L${n(cx + Math.cos(a) * r2)} ${n(cy + Math.sin(a) * r2)}`;
  }
  return `<path d="${d}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
}

/** שמש בסולם: 0 מלאה, 1 חצי, 2 קו מתאר, 3 קו מתאר דק (צל). פעילה — זהב; לא פעילה — חיוורת. */
function sun(step: number, cx: number, cy: number, r: number, active: boolean): string {
  const stroke = active ? C.sunStroke : C.sunOff;
  const w = step === 3 ? 0.16 : 0.22;
  const rays = sunRays(cx, cy, r * 1.4, r * (step === 3 ? 1.75 : 1.9), stroke, w);
  if (step === 0)
    return `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${active ? C.sun : C.sunOff}" stroke="${stroke}" stroke-width="${w}"/>`;
  if (step === 1)
    return `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${active ? '#fffaf0' : 'none'}" stroke="${stroke}" stroke-width="${w}"/><path d="M${cx} ${n(cy - r)}A${r} ${r} 0 0 0 ${cx} ${n(cy + r)}Z" fill="${active ? C.sun : C.sunOff}"/>`;
  return `${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${w}"${step === 3 ? ' stroke-dasharray="0.5 0.35"' : ''}/>`;
}

/** טיפה בגובה h; fill: 0 ריקה, 0.5 חצי (מימין לשמאל), 1 מלאה */
function drop(cx: number, cy: number, h: number, fill: number, uid: string, i: number): string {
  const s = h / 1.35;
  const shape = 'M0 -0.675C0.16 -0.42 0.5 -0.12 0.5 0.18A0.5 0.5 0 0 1 -0.5 0.18C-0.5 -0.12 -0.16 -0.42 0 -0.675Z';
  const t = `translate(${n(cx)} ${n(cy + h * 0.06)}) scale(${n(s)})`;
  const outline = `<path d="${shape}" transform="${t}" fill="none" stroke="${fill > 0 ? C.drop : C.dropOff}" stroke-width="${n(0.26 / s)}" stroke-linejoin="round"/>`;
  if (fill <= 0) return outline;
  const shine = `<path d="M-0.28 0.12A0.3 0.3 0 0 0 -0.08 0.4" transform="${t}" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="0.09" stroke-linecap="round"/>`;
  if (fill >= 1) return `<path d="${shape}" transform="${t}" fill="${C.drop}"/>${shine}`;
  const id = `ps-dh-${uid}-${i}`;
  // חצי טיפה: הצד הימני מלא (סולם מימין לשמאל). ה-clipPath במערכת הצירים של הטיפה (כבר אחרי ה-transform שלה)
  return `<clipPath id="${id}"><rect x="0" y="-1" width="1" height="2"/></clipPath><path d="${shape}" transform="${t}" fill="${C.drop}" clip-path="url(#${id})"/>${outline}`;
}

const DROP_ICON = (cx: number, cy: number, h: number) => {
  const s = h / 1.35;
  return `<path d="M0 -0.675C0.16 -0.42 0.5 -0.12 0.5 0.18A0.5 0.5 0 0 1 -0.5 0.18C-0.5 -0.12 -0.16 -0.42 0 -0.675Z" transform="translate(${n(cx)} ${n(cy + h * 0.06)}) scale(${n(s)})" fill="${C.drop}"/>`;
};

/** עלה: מנקודת הבסיס, באורך len ובזווית angle (מעלות) */
function leaf(x: number, y: number, len: number, angle: number, fill: string, opacity = 1, vein = true): string {
  const w = len * 0.36;
  const d = `M0 0C${n(len * 0.3)} ${n(-w)} ${n(len * 0.78)} ${n(-w * 0.85)} ${n(len)} 0C${n(len * 0.78)} ${n(w * 0.85)} ${n(len * 0.3)} ${n(w)} 0 0Z`;
  const v = vein
    ? `<path d="M${n(len * 0.06)} 0L${n(len * 0.9)} 0" stroke="#ffffff" stroke-opacity=".35" stroke-width="${n(len * 0.025)}" fill="none"/>`
    : '';
  return `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})" opacity="${opacity}"><path d="${d}" fill="${fill}"/>${v}</g>`;
}

/** ענף דקורטיבי: גבעול (עקומה ריבועית) ועלים לסירוגין שקטנים לכיוון הקצה */
function sprig(
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
  count: number,
  maxLen: number,
  tone: 'dark' | 'light',
): string {
  const at = (t: number): [number, number] => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1],
  ];
  const tangent = (t: number) => {
    const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };
  const fills = tone === 'dark' ? ['#5d8450', '#73985f', '#86a872'] : ['#8fae7c', '#a3bd91', '#b7cca6'];
  let out = `<path d="M${p0[0]} ${p0[1]}Q${c[0]} ${c[1]} ${p1[0]} ${p1[1]}" stroke="${fills[0]}" stroke-width="0.32" fill="none" stroke-linecap="round"/>`;
  for (let i = 0; i < count; i++) {
    const t = 0.14 + (0.8 * i) / Math.max(1, count - 1);
    const [x, y] = at(t);
    const side = i % 2 === 0 ? 1 : -1;
    const len = maxLen * (1 - t * 0.45);
    out += leaf(x, y, len, tangent(t) + side * 48, fills[i % 3]!, 0.92);
  }
  // עלה בקצה
  out += leaf(p1[0], p1[1], maxLen * 0.55, tangent(1), fills[1]!, 0.92);
  return out;
}

const SEEDLING = (cx: number, cy: number, s: number, color: string) =>
  `<g transform="translate(${cx} ${cy}) scale(${s})" fill="none" stroke="${color}" stroke-width="0.42" stroke-linecap="round" stroke-linejoin="round"><path d="M0 2.6V-0.2"/><path d="M0 0.4C0 -1.6 -1.1 -2.4 -2.7 -2.4C-2.7 -0.9 -1.7 0.4 0 0.4Z" fill="${color}" fill-opacity=".25"/><path d="M0 -0.2C0 -1.9 1.2 -2.9 2.9 -2.9C2.9 -1.2 1.8 -0.2 0 -0.2Z" fill="${color}" fill-opacity=".25"/></g>`;

const PENCIL = (cx: number, cy: number, s: number, color: string) =>
  `<g transform="translate(${cx} ${cy}) scale(${s}) rotate(45)" fill="none" stroke="${color}" stroke-width="0.4" stroke-linejoin="round"><path d="M-0.75 -2.9H0.75V1.7L0 2.9L-0.75 1.7Z"/><path d="M-0.75 -2.1H0.75M-0.75 1.7H0.75"/></g>`;

// ---------- רשתות ----------

const SOCIAL_PATHS: Record<SignSocial, string> = {
  FACEBOOK:
    'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z',
  INSTAGRAM:
    'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.5.01-4.74.07-1.14.05-1.76.24-2.17.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.41-.35 1.03-.4 2.17-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.05 1.14.24 1.76.4 2.17.22.55.47.94.88 1.35.41.41.8.66 1.35.88.41.16 1.03.35 2.17.4 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.17-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.05-1.14-.24-1.76-.4-2.17a3.63 3.63 0 0 0-.88-1.35 3.63 3.63 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.17-.4-1.24-.06-1.59-.07-4.74-.07Zm0 2.76a5.7 5.7 0 1 1 0 11.4 5.7 5.7 0 0 1 0-11.4Zm0 9.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Zm7.26-9.62a1.33 1.33 0 1 1-2.66 0 1.33 1.33 0 0 1 2.66 0Z',
  TIKTOK:
    'M16.5 5.4c-.9-1-1.4-2.3-1.4-3.6h-3v13.1c0 1.5-1.2 2.7-2.7 2.7a2.7 2.7 0 0 1-2.7-2.7 2.7 2.7 0 0 1 3.5-2.6V6.7A5.85 5.85 0 0 0 3.4 12a5.85 5.85 0 0 0 5.9 5.8c3.3 0 5.9-2.6 5.9-5.8V8.6a8.6 8.6 0 0 0 5 1.6V7.2c-1.2 0-2.4-.6-3.6-1.8Z',
  YOUTUBE:
    'M23 12s0-3.2-.4-4.7a2.9 2.9 0 0 0-2-2C18.8 5 12 5 12 5s-6.8 0-8.6.3a2.9 2.9 0 0 0-2 2C1 8.8 1 12 1 12s0 3.2.4 4.7c.3 1 1 1.7 2 2C5.2 19 12 19 12 19s6.8 0 8.6-.3c1-.3 1.7-1 2-2C23 15.2 23 12 23 12ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z',
  WHATSAPP:
    'M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.1-.3.2-.5 0-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4.2-.4c.1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4 0-.6.3s-.9.9-.9 2.1.9 2.5 1 2.6c.1.2 1.8 2.7 4.3 3.8.6.3 1.1.4 1.4.5.6.2 1.2.2 1.6.1.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.2-.2-.2-.4-.3Z',
};

export const SOCIAL_LABELS: Record<SignSocial, string> = {
  FACEBOOK: 'פייסבוק',
  INSTAGRAM: 'אינסטגרם',
  TIKTOK: 'טיקטוק',
  YOUTUBE: 'יוטיוב',
  WHATSAPP: 'וואטסאפ',
};

// ---------- השלט ----------

export interface RenderOptions {
  /** מזהה ייחודי בדף (כמה שלטים באותו מסמך) */
  uid: string;
  /** גלישה של 3 מ"מ לדפוס */
  bleed?: boolean;
  /** סימן מים "תצוגה מקדימה" */
  watermark?: boolean;
}

export function renderSign(d: SignData, opts: RenderOptions): string {
  const uid = opts.uid.replace(/[^a-zA-Z0-9_-]/g, '');
  const b = opts.bleed ? BLEED : 0;
  const W = SIGN_W + b * 2;
  const H = SIGN_H + b * 2;
  const photoId = `ps-photo-${uid}`;
  const bgId = `ps-bg-${uid}`;
  const phId = `ps-ph-${uid}`;

  const photoPath = 'M5.5 2L47 2C54.5 14 59 29 57.3 43.5C56 55 53.6 64.5 51.2 72L2 72L2 5.5Q2 2 5.5 2Z';

  // ---- שכבת הגרפיקה ----
  let g = '';
  g += `<defs><radialGradient id="${bgId}" cx="62%" cy="38%" r="75%"><stop offset="0" stop-color="${C.paperLight}"/><stop offset="1" stop-color="${C.paper}"/></radialGradient>`;
  g += `<linearGradient id="${phId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4ecd9"/><stop offset="1" stop-color="#c7d7b8"/></linearGradient>`;
  g += `<clipPath id="${photoId}"><path d="${photoPath}"/></clipPath></defs>`;
  g += `<rect x="${-b}" y="${-b}" width="${W}" height="${H}" fill="url(#${bgId})"/>`;

  // תמונת הצמח במסכה האסימטרית
  if (d.imageUrl) {
    g += `<image href="${esc(d.imageUrl)}" x="2" y="2" width="58" height="70" preserveAspectRatio="xMidYMid slice" clip-path="url(#${photoId})"/>`;
  } else {
    g += `<path d="${photoPath}" fill="url(#${phId})"/>`;
    g += `<g clip-path="url(#${photoId})">${sprig([14, 66], [22, 40], [36, 14], 9, 10, 'light')}</g>`;
  }
  // קו מתאר עדין לצד המסכה, וקשת פינת הלוגו
  g += `<path d="M49.2 2C56.7 14 61.2 29 59.5 43.5C58.2 55 55.8 64.5 53.4 72" stroke="${C.gold}" stroke-width="0.3" fill="none"/>`;
  g += `<path d="M124.6 2C123.6 14.6 130.2 24.2 148 25.2" stroke="${C.gold}" stroke-width="0.3" fill="none"/>`;

  // מסגרת, ומעליה ענפים דקורטיביים בפינות התחתונות (חלקם בשטח הגלישה), מתחת לכרטיסים
  g += `<rect x="2" y="2" width="146" height="96" rx="3.5" fill="none" stroke="${C.frame}" stroke-width="0.4"/>`;
  g += sprig([21, 101.5], [14.5, 97.6], [8.6, 95.2], 5, 4.2, 'light');
  g += sprig([12.5, 101.6], [2.6, 97.5], [0.6, 80.6], 10, 5.8, 'dark');
  g += sprig([152.4, 97], [148.8, 88], [146.2, 79.4], 6, 4.4, 'light');
  g += sprig([150.6, 101.8], [144.8, 89], [142, 71.6], 12, 6, 'dark');

  // קו מפריד מתחת לשמות, עם עלה באמצע
  g += `<path d="M64 24.8H88.6M95.4 24.8H120" stroke="#b9ae8f" stroke-width="0.22" stroke-linecap="round"/>`;
  g += leaf(92, 25.3, 2.6, -128, C.leaf, 1, false) + leaf(92, 25.3, 2.6, -52, '#7fa06d', 1, false);

  // כרטיס השקיה
  g += `<rect x="57.8" y="46" width="35.6" height="23.6" rx="2.6" fill="#ffffff" fill-opacity=".38" stroke="${C.cardBorder}" stroke-width="0.25"/>`;
  g += `<circle cx="63.4" cy="48.4" r="3.5" fill="#fbfaf6" stroke="#3f6b46" stroke-width="0.3"/>${DROP_ICON(63.4, 48.3, 3.4)}`;
  const amount = d.water.amount;
  [82, 75.6, 69.2].forEach((x, i) => {
    const fill = amount >= i + 1 ? 1 : amount >= i + 0.5 ? 0.5 : 0;
    g += drop(x, 55.6, 4.7, fill, uid, i);
  });

  // כרטיס אור
  g += `<rect x="96.4" y="46" width="39" height="23.6" rx="2.6" fill="${C.lightCard}" stroke="${C.lightBorder}" stroke-width="0.25"/>`;
  g += `<circle cx="102.4" cy="48.4" r="3.5" fill="#fdf3d6" stroke="#e2bd5a" stroke-width="0.3"/>`;
  g +=
    sunRays(102.4, 48.4, 1.65, 2.35, C.sunStroke, 0.22) +
    `<circle cx="102.4" cy="48.4" r="1.2" fill="${C.sun}" stroke="${C.sunStroke}" stroke-width="0.18"/>`;
  const r = d.light.range;
  // סדר מימין לשמאל: שמש מלאה ← צל
  [126.4, 119.4, 112.4, 105.4].forEach((x, step) => {
    g += sun(step, x, 55.6, 1.75, Boolean(r && step >= r[0] && step <= r[1]));
  });

  // QR
  const qr = qrPath(d.qrUrl);
  const qrSize = 14.6;
  const qrScale = qrSize / qr.size;
  g += `<rect x="4.7" y="74" width="17.4" height="17.4" rx="1.6" fill="#fffdf8" stroke="${C.frame}" stroke-width="0.35"/>`;
  g += `<path d="${qr.d}" transform="translate(6.1 75.4) scale(${n(qrScale)})" fill="${C.ink}" shape-rendering="crispEdges"/>`;
  // חץ "סרקו אותי"
  g += `<path d="M26.4 78.4C25.8 77.2 24.6 76.9 23.3 77.6" stroke="${C.ink}" stroke-width="0.26" fill="none" stroke-linecap="round"/><path d="M24.3 76.7L23.1 77.7L24.5 78.3" stroke="${C.ink}" stroke-width="0.26" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

  // סוג הצמח
  g += `<rect x="40.7" y="72.8" width="26.9" height="20.8" rx="2.4" fill="#ffffff" fill-opacity=".38" stroke="${C.cardBorder}" stroke-width="0.25"/>`;
  g += `<circle cx="46.6" cy="77.2" r="3.4" fill="${C.leaf}"/>${SEEDLING(46.6, 77.4, 0.62, '#ffffff')}`;

  // הערות
  g += `<rect x="70" y="72.8" width="40.2" height="20.8" rx="2.4" fill="#ffffff" fill-opacity=".38" stroke="${C.cardBorder}" stroke-width="0.25"/>`;
  g += `<circle cx="104.6" cy="77.2" r="3.4" fill="${C.leaf}"/>${PENCIL(104.6, 77.2, 0.62, '#ffffff')}`;
  if (!d.notes) {
    for (const y of [82, 85.2, 88.4, 91.4])
      g += `<path d="M73 ${y}H107.4" stroke="#bdb6a2" stroke-width="0.2" stroke-dasharray="0.7 0.6"/>`;
  }

  // קו אנכי לפני הרשתות
  g += `<path d="M112.6 75V92" stroke="${C.line}" stroke-width="0.25"/>`;

  // רשתות חברתיות
  const socials = d.socials.slice(0, 4);
  const gap = socials.length >= 4 ? 7.4 : 9.4;
  const centerX = 129.6;
  const xs = socials.map((_, i) => centerX + ((socials.length - 1) / 2 - i) * gap);
  socials.forEach((s, i) => {
    const x = xs[i]!;
    g += `<circle cx="${n(x)}" cy="79.6" r="3.3" fill="${C.ink}"/><path d="${SOCIAL_PATHS[s]}" transform="translate(${n(x - 1.85)} 77.75) scale(0.154)" fill="#ffffff"/>`;
  });

  const svg = `<svg class="ps-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${-b} ${-b} ${W} ${H}" width="${W}mm" height="${H}mm" aria-hidden="true">${g}</svg>`;

  // ---- שכבת הטקסט ----
  let t = '';
  if (d.logoUrl) {
    t += `<img class="ps-logo" src="${esc(d.logoUrl)}" alt="" style="left:127.6mm;top:4.4mm;width:18.6mm;height:15.6mm"/>`;
  } else {
    t += box('ps-h', 127, 5, 19.6, 14, 4.2, 2.4, esc(d.nurseryName));
  }
  t += box('ps-title', 60, 6, 63, 11.6, 9.6, 4.2, esc(d.hebrewName));
  if (d.latinName) t += box('ps-latin', 60, 17.7, 63, 4.8, 3.7, 2.3, esc(d.latinName));
  if (d.description) t += box('ps-desc', 61.2, 27.4, 60.6, 16.2, 2.95, 2.05, esc(d.description));

  t += box('ps-h', 67.6, 46.6, 18, 4.4, 3.3, 2.6, 'השקיה');
  t += box('ps-label', 59, 59.1, 33.2, 3.8, 2.9, 2.1, esc(d.water.title));
  t += box('ps-note', 59.6, 62.8, 32, 6.2, 2.3, 1.65, esc(d.water.note));

  t += box('ps-h', 106.8, 46.6, 18, 4.4, 3.3, 2.6, 'אור');
  t += box('ps-label', 97.6, 59.1, 36.6, 3.8, 2.9, 2.1, esc(d.light.title));
  t += box('ps-note', 98.2, 62.8, 35.4, 6.2, 2.3, 1.65, esc(d.light.note));

  t += `<div class="ps-box" style="left:26.6mm;top:76.2mm;width:13.6mm;height:8.4mm"><div class="ps-in ps-scan" style="font-size:2.05mm"><b style="font-size:2.45mm">סרקו אותי</b>למעבר לדף המלא של הצמח</div></div>`;

  t += box('ps-h', 50.6, 75, 16, 4.6, 3.0, 2.3, 'סוג הצמח');
  if (d.plantType) t += box('ps-small', 42.4, 82, 23.6, 10.4, 2.65, 1.85, esc(d.plantType));

  t += box('ps-h', 82, 75, 19, 4.6, 3.0, 2.3, 'הערות');
  if (d.notes) t += box('ps-small', 72.4, 81.2, 35.4, 11.2, 2.6, 1.8, esc(d.notes));

  if (socials.length) {
    socials.forEach((s, i) => {
      t += box('ps-small', xs[i]! - 4.4, 83.6, 8.8, 3.2, 2.05, 1.6, SOCIAL_LABELS[s]);
    });
  } else {
    const site = d.website ?? d.nurseryName;
    t += box('ps-label', 114.6, 76, 31.6, 8, 2.8, 1.8, esc(site), d.website ? 'direction:ltr' : '');
  }

  const wm = opts.watermark ? `<div class="ps-wm">תצוגה מקדימה</div>` : '';
  return `<div class="ps-sheet" dir="rtl" style="width:${W}mm;height:${H}mm">${svg}<div class="ps-layer" style="left:${b}mm;top:${b}mm;width:${SIGN_W}mm;height:${SIGN_H}mm">${t}</div>${wm}</div>`;
}
