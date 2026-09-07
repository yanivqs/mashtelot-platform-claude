/**
 * רישום המודולים של הפלטפורמה (ללא תלות בשרת — בטוח לייבוא מרכיבי לקוח).
 * שיוך מודול למשתלה נשמר בטבלת `nursery_modules`. מודול ללא רשומה = כבוי.
 * מודולים חדשים מתווספים כאן ומקבלים אוטומטית שיוך/gating.
 */

export const MODULE_KEYS = [
  'plant_catalog',
  'supplies',
  'orders',
  'promotions',
  'print_shop',
  'static_pages',
  'blog',
  'social',
  'design',
  'sales',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  description: string;
  /** פריטי ניווט שהמודול פותח בפורטל של בעל המשתלה */
  ownerNav?: { href: string; label: string; icon: string }[];
  /** תצורת ברירת מחדל בעת הפעלת המודול */
  defaultConfig?: Record<string, unknown>;
}

export const MODULES: ModuleDef[] = [
  {
    key: 'plant_catalog',
    label: 'קטלוג צמחים',
    description: 'הוספת צמחים מהקטלוג הבוטני המרכזי לחנות, ותצוגתם בחנות.',
    ownerNav: [
      { href: '/admin/products', label: 'המלאי שלי', icon: 'Package' },
      { href: '/admin/products/browse', label: 'הוספת מוצרים', icon: 'PlusSquare' },
    ],
  },
  {
    key: 'supplies',
    label: 'מוצרים וציוד',
    description: 'הוספת ציוד וחומרים (אדמה, עציצים, דשנים) לחנות.',
  },
  {
    key: 'orders',
    label: 'הזמנות',
    description: 'קבלת הזמנות אונליין וניהולן בפורטל.',
    ownerNav: [{ href: '/admin/orders', label: 'הזמנות', icon: 'ShoppingBag' }],
  },
  {
    key: 'promotions',
    label: 'מבצעים וקופונים',
    description: 'קופונים והנחות + פופ-אפ שיווקי בחנות.',
    ownerNav: [{ href: '/admin/marketing', label: 'שיווק', icon: 'Megaphone' }],
  },
  {
    key: 'print_shop',
    label: 'בית דפוס',
    description: 'הזמנת שילוט, תגים וחומרי מיתוג מבית הדפוס של הפלטפורמה.',
    ownerNav: [{ href: '/admin/print-shop', label: 'בית דפוס', icon: 'Printer' }],
  },
  {
    key: 'static_pages',
    label: 'עמודים סטטיים',
    description: 'עמודי תוכן (אודות, תקנון, משלוחים) בחנות.',
    ownerNav: [{ href: '/admin/pages', label: 'עמודים', icon: 'FileText' }],
  },
  {
    key: 'blog',
    label: 'בלוג',
    description: 'מאמרים ותוכן שיווקי לקידום אורגני.',
    ownerNav: [{ href: '/admin/blog', label: 'בלוג', icon: 'Newspaper' }],
  },
  {
    key: 'social',
    label: 'רשתות חברתיות',
    description: 'הצגת קישורי רשתות חברתיות בחנות (פוטר ועמוד יצירת קשר).',
  },
  {
    key: 'design',
    label: 'שליטה בעיצוב',
    description: 'מאפשר לבעל המשתלה לערוך את חלקי העיצוב המסומנים למטה.',
    defaultConfig: { colors: true, hero: true, carousel: false, popup: false, sticky: true },
  },
  {
    key: 'sales',
    label: 'אפשרויות מכירה',
    description: 'הצעת מחיר בלבד או הזמנה אונליין עם תשלום.',
    defaultConfig: { mode: 'ONLINE' },
  },
];

export function getModuleDef(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}

export function defaultConfigFor(key: ModuleKey): Record<string, unknown> {
  return { ...(getModuleDef(key)?.defaultConfig ?? {}) };
}
