/**
 * רישום המודולים של הפלטפורמה (ללא תלות בשרת — בטוח לייבוא מרכיבי לקוח).
 *
 * מערכת הבסיס תמיד פעילה ומתומחרת כחבילה אחת (החלטת בעלים 2026-11-02). תוספות נדלקות לכל משתלה
 * במסך "חשבונות משתלות", ונשמרות בטבלת `nursery_modules`. תוספת בלי רשומה = כבויה.
 */

/** מפתחות שקוד הפלטפורמה בודק ושתמיד פעילים: מערכת הבסיס */
export const BASE_MODULE_KEYS = ['plant_catalog', 'supplies', 'orders', 'print_shop', 'sales', 'social'] as const;

export const ADDON_MODULE_KEYS = [
  'announcement',
  'coupons',
  'popups',
  'newsletter',
  'payment_options',
  'delivery_options',
  'static_pages',
  'blog',
  'shipping',
  'crm',
  'loyalty',
  'page_builder',
  'team',
  'design',
  'customer_accounts',
] as const;

export const MODULE_KEYS = [...BASE_MODULE_KEYS, ...ADDON_MODULE_KEYS] as const;

export type BaseModuleKey = (typeof BASE_MODULE_KEYS)[number];
export type AddonModuleKey = (typeof ADDON_MODULE_KEYS)[number];
export type ModuleKey = BaseModuleKey | AddonModuleKey;

export function isBaseModule(key: string): key is BaseModuleKey {
  return (BASE_MODULE_KEYS as readonly string[]).includes(key);
}

/** מה כלול במערכת הבסיס, לפי סדר התפריט */
export const BASE_PARTS = [
  'המלאי שלי',
  'שיוך מוצרים',
  'הקטגוריות שלי',
  'הזמנות',
  'הפניות SEO',
  'הגדרות משתלה (ללא אפשרויות תשלום ומשלוח)',
  'בית דפוס',
  'יומן פעילות',
  'עדכונים מהקטלוג',
] as const;

export interface AddonDef {
  key: AddonModuleKey;
  label: string;
  description: string;
  group: 'שיווק' | 'הגדרות המשתלה' | 'תוכן' | 'לקוחות' | 'ניהול' | 'נוספים';
  /** מודול שנדרש כדי שהתוספת תעבוד */
  requires?: AddonModuleKey;
  /** תצורת ברירת מחדל בעת הפעלת המודול */
  defaultConfig?: Record<string, unknown>;
}

export const ADDONS: AddonDef[] = [
  { key: 'announcement', group: 'שיווק', label: 'הודעת סטיקי', description: 'הודעה קבועה בראש החנות.' },
  { key: 'coupons', group: 'שיווק', label: 'קופונים', description: 'קודי הנחה בקופה.' },
  { key: 'popups', group: 'שיווק', label: 'פופאפים', description: 'פופאפ שיווקי בחנות.' },
  { key: 'newsletter', group: 'שיווק', label: 'תפוצת דואר', description: 'טופס הרשמה בתחתית החנות, רשימת נרשמים ויצוא לקובץ.' },
  { key: 'payment_options', group: 'הגדרות המשתלה', label: 'אפשרויות תשלום', description: 'בעל המשתלה עורך את אמצעי התשלום בקופה.' },
  { key: 'delivery_options', group: 'הגדרות המשתלה', label: 'אפשרויות משלוח', description: 'בעל המשתלה קובע איסוף עצמי ומשלוחים בקופה.' },
  { key: 'static_pages', group: 'תוכן', label: 'עמודים', description: 'עמודי תוכן (אודות, תקנון וכו׳) בחנות.' },
  { key: 'blog', group: 'תוכן', label: 'בלוג', description: 'מאמרים ותוכן שיווקי לקידום אורגני.' },
  { key: 'page_builder', group: 'תוכן', label: 'עיצוב דף הבית', description: 'בניית דף הבית מבלוקים: טיוטה, תצוגה מקדימה, תזמון והיסטוריה.' },
  { key: 'shipping', group: 'לקוחות', label: 'משלוחים', description: 'אזורי משלוח לפי ערים, עם עלות ורף למשלוח חינם.' },
  { key: 'crm', group: 'לקוחות', label: 'לקוחות', description: 'רשימת לקוחות, תגיות, הערות, קבוצות, סינון ויצוא.' },
  { key: 'loyalty', group: 'לקוחות', label: 'מועדון לקוחות', description: 'צבירה ומימוש נקודות, ו"הזמן שוב" מהזמנות קודמות.', requires: 'customer_accounts' },
  { key: 'team', group: 'ניהול', label: 'צוות', description: 'הוספת עובדים וכותבי תוכן למשתלה.' },
  { key: 'customer_accounts', group: 'נוספים', label: 'חשבונות לקוח', description: 'לקוחות נרשמים ומתחברים בחנות עם קוד במייל ורואים את ההזמנות שלהם.' },
  { key: 'design', group: 'נוספים', label: 'שליטה בעיצוב', description: 'בעל המשתלה עורך את חלקי העיצוב המסומנים (צבעים, Hero ועוד).', defaultConfig: { colors: true, hero: true, carousel: true, popup: false, sticky: true } },
];

export const ADDON_GROUPS: AddonDef['group'][] = ['שיווק', 'הגדרות המשתלה', 'תוכן', 'לקוחות', 'ניהול', 'נוספים'];

export function getAddonDef(key: string): AddonDef | undefined {
  return ADDONS.find((m) => m.key === key);
}

const BASE_DEFAULTS: Partial<Record<ModuleKey, Record<string, unknown>>> = { sales: { mode: 'ONLINE' } };

export function defaultConfigFor(key: ModuleKey): Record<string, unknown> {
  return { ...(BASE_DEFAULTS[key] ?? getAddonDef(key)?.defaultConfig ?? {}) };
}
