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
  'shipping',
  'customer_accounts',
  'loyalty',
  'crm',
  'page_builder',
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
    defaultConfig: { colors: true, hero: true, carousel: true, popup: false, sticky: true },
  },
  {
    key: 'sales',
    label: 'אפשרויות מכירה',
    description: 'הצעת מחיר בלבד או הזמנה אונליין עם תשלום.',
    defaultConfig: { mode: 'ONLINE' },
  },
  {
    key: 'shipping',
    label: 'אזורי משלוח',
    description: 'הגדרת אזורי משלוח לפי ערים, עם עלות ורף למשלוח חינם.',
    ownerNav: [{ href: '/admin/shipping', label: 'משלוחים', icon: 'Truck' }],
  },
  {
    key: 'customer_accounts',
    label: 'חשבונות לקוח',
    description: 'שדרוג: לקוחות נרשמים ומתחברים בחנות עם קוד במייל, ורואים את ההזמנות והפרטים שלהם.',
  },
  {
    key: 'loyalty',
    label: 'מועדון לקוחות',
    description: 'שדרוג (דורש חשבונות לקוח): "הזמן שוב" מהזמנות קודמות, וצבירה ומימוש נקודות.',
    ownerNav: [{ href: '/admin/loyalty', label: 'מועדון לקוחות', icon: 'Gift' }],
  },
  {
    key: 'crm',
    label: 'לקוחות (CRM)',
    description: 'שדרוג: רשימת לקוחות (רשומים ואורחים), תגיות, הערות, קבוצות, סינון ויצוא למי שהסכים לדיוור.',
    ownerNav: [{ href: '/admin/customers', label: 'לקוחות', icon: 'Users' }],
  },
  {
    key: 'page_builder',
    label: 'בונה עמודים',
    description: 'שדרוג: בניית דף הבית ועמודי התוכן מבלוקים מאושרים — טיוטה, תצוגה מקדימה, תזמון והיסטוריה.',
    ownerNav: [{ href: '/admin/page-builder', label: 'עיצוב דף הבית', icon: 'LayoutTemplate' }],
  },
];

export function getModuleDef(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}

export function defaultConfigFor(key: ModuleKey): Record<string, unknown> {
  return { ...(getModuleDef(key)?.defaultConfig ?? {}) };
}
