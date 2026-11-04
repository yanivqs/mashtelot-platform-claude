/**
 * הגדרות תפריט הנגישות של הגולש. נשמרות בדפדפן בלבד: אין שליחה לשרת ואין מעקב.
 * כל הגדרה הופכת למאפיין data-a11y-* על <html>, ו-a11y.css עושה את השאר.
 * לוגיקה טהורה, משותפת לרכיב ולסקריפט שרץ לפני הציור הראשון.
 */
export const A11Y_STORAGE_KEY = 'a11y-settings-v1';

export type A11yContrast = 'none' | 'dark' | 'light';
export type A11yColor = 'none' | 'mono' | 'low' | 'high';
export type A11yGuide = 'none' | 'line' | 'mask';
export type A11yProfile = 'vision' | 'dyslexia' | 'seizure' | 'adhd' | 'senior' | 'motor';

export interface A11ySettings {
  text: 0 | 1 | 2 | 3;
  lineheight: 0 | 1 | 2;
  spacing: 0 | 1 | 2;
  font: boolean;
  align: boolean;
  contrast: A11yContrast;
  color: A11yColor;
  links: boolean;
  headings: boolean;
  focus: boolean;
  cursor: boolean;
  targets: boolean;
  motion: boolean;
  hideimages: boolean;
  guide: A11yGuide;
  alttips: boolean;
  speak: boolean;
  profile: A11yProfile | null;
}

export const A11Y_DEFAULTS: A11ySettings = {
  text: 0,
  lineheight: 0,
  spacing: 0,
  font: false,
  align: false,
  contrast: 'none',
  color: 'none',
  links: false,
  headings: false,
  focus: false,
  cursor: false,
  targets: false,
  motion: false,
  hideimages: false,
  guide: 'none',
  alttips: false,
  speak: false,
  profile: null,
};

/** הגדרות שמשפיעות על המראה דרך CSS. הקראה ותיאור תמונות פועלים בקוד, והפרופיל הוא רק סימון. */
export const A11Y_ATTRIBUTE_KEYS = [
  'text',
  'lineheight',
  'spacing',
  'font',
  'align',
  'contrast',
  'color',
  'links',
  'headings',
  'focus',
  'cursor',
  'targets',
  'motion',
  'hideimages',
] as const;

export const A11Y_TEXT_LABELS = ['רגיל', '125%', '150%', '200%'] as const;
export const A11Y_LEVEL_LABELS = ['רגיל', 'בינוני', 'גדול'] as const;

export const A11Y_PROFILES: Record<A11yProfile, { label: string; hint: string; settings: Partial<A11ySettings> }> = {
  vision: { label: 'לקויי ראייה', hint: 'טקסט גדול, ניגודיות גבוהה וסימון פוקוס', settings: { text: 2, contrast: 'dark', focus: true, links: true, cursor: true } },
  dyslexia: { label: 'דיסלקציה', hint: 'גופן פשוט, מרווחים גדולים ויישור לימין', settings: { font: true, spacing: 1, lineheight: 1, align: true } },
  seizure: { label: 'רגישות להבהובים', hint: 'עצירת תנועה והפחתת צבעים', settings: { motion: true, color: 'low' } },
  adhd: { label: 'קשב וריכוז', hint: 'עצירת תנועה ומסיכת קריאה', settings: { motion: true, guide: 'mask', headings: true } },
  senior: { label: 'גיל השלישי', hint: 'טקסט וכפתורים גדולים וקישורים בולטים', settings: { text: 1, targets: true, links: true, lineheight: 1, cursor: true } },
  motor: { label: 'מוגבלות מוטורית', hint: 'כפתורים גדולים, סימון פוקוס ועצירת תנועה', settings: { targets: true, focus: true, motion: true } },
};

const ALLOWED: { [K in keyof A11ySettings]: readonly A11ySettings[K][] } = {
  text: [0, 1, 2, 3],
  lineheight: [0, 1, 2],
  spacing: [0, 1, 2],
  font: [false, true],
  align: [false, true],
  contrast: ['none', 'dark', 'light'],
  color: ['none', 'mono', 'low', 'high'],
  links: [false, true],
  headings: [false, true],
  focus: [false, true],
  cursor: [false, true],
  targets: [false, true],
  motion: [false, true],
  hideimages: [false, true],
  guide: ['none', 'line', 'mask'],
  alttips: [false, true],
  speak: [false, true],
  profile: [null, 'vision', 'dyslexia', 'seizure', 'adhd', 'senior', 'motor'],
};

/** קלט מהאחסון של הדפדפן: ערך לא מוכר חוזר לברירת המחדל. */
export function sanitizeA11ySettings(raw: unknown): A11ySettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...A11Y_DEFAULTS };
  for (const key of Object.keys(A11Y_DEFAULTS) as (keyof A11ySettings)[]) {
    if ((ALLOWED[key] as readonly unknown[]).includes(source[key])) out[key] = source[key];
  }
  return out as unknown as A11ySettings;
}

/** ערך ברירת מחדל לא מייצר מאפיין, כדי שאתר בלי התאמות יישאר נקי לגמרי. */
export function a11yAttributes(settings: A11ySettings): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of A11Y_ATTRIBUTE_KEYS) {
    const value = settings[key];
    if (value === false || value === 0 || value === 'none') continue;
    out[`data-a11y-${key}`] = value === true ? '1' : String(value);
  }
  return out;
}

export function isA11yDefault(settings: A11ySettings): boolean {
  return (Object.keys(A11Y_DEFAULTS) as (keyof A11ySettings)[]).every((k) => settings[k] === A11Y_DEFAULTS[k]);
}

/** הפעלת פרופיל מחליפה את כל ההגדרות, ולחיצה חוזרת עליו מחזירה לברירת המחדל. */
export function toggleA11yProfile(settings: A11ySettings, profile: A11yProfile): A11ySettings {
  if (settings.profile === profile) return { ...A11Y_DEFAULTS };
  return { ...A11Y_DEFAULTS, ...A11Y_PROFILES[profile].settings, profile };
}

/** שינוי ידני מנתק מהפרופיל, כי ההגדרות כבר לא תואמות לו. */
export function changeA11ySetting<K extends keyof A11ySettings>(settings: A11ySettings, key: K, value: A11ySettings[K]): A11ySettings {
  return { ...settings, [key]: value, profile: null };
}

/**
 * רץ ב-head לפני הציור הראשון, כדי שגולש עם ניגודיות או טקסט גדול לא יראה הבהוב של העיצוב הרגיל.
 * עצמאי לגמרי, ובודק את הערכים לפני שהם מגיעים ל-DOM.
 */
export const A11Y_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(A11Y_STORAGE_KEY)})||'{}');var k=${JSON.stringify(A11Y_ATTRIBUTE_KEYS)};for(var i=0;i<k.length;i++){var v=s[k[i]];if(v===true)v='1';if(typeof v==='number'&&v>0&&v<4)v=String(v);if(typeof v==='string'&&v!=='none'&&/^[a-z0-9]+$/.test(v))document.documentElement.setAttribute('data-a11y-'+k[i],v);}}catch(e){}})();`;
