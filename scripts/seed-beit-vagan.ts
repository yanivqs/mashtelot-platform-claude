/**
 * "משתלת בית וגן" — שדרוג החנות הקיימת (subdomain: baitvagan) לאתר מכירתי (2026-10-29, באישור הבעלים).
 *
 *   npx vite-node -c vitest.config.ts scripts/seed-beit-vagan.ts -- [--dry-run] [--confirm-production=baitvagan]
 *
 * תוספות ועדכונים בלבד — לא מוחק דבר ולא יוצר משתמשים. ניתן להריץ שוב (אידמפוטנטי):
 * - עיצוב: ירוק כהה / כתום / בז', סרגל צף בנייד, הודעת סטיקי (ממוזג ל-themeConfig הקיים)
 * - מודולים: מכירה אונליין, הזמנות, שיווק, Page Builder; אמצעי תשלום: תשלום באיסוף
 * - קטגוריות-על צמחים / פרחים / מוצרי גינון; קטגוריות-על קיימות ללא הורה נכנסות תחתיהן
 * - מוצרים מהקטלוג המרכזי ומקטלוג הציוד (מוצר קיים — לא נוגעים בו), חלקם עם גודל × צבע
 * - פוסטים בבלוג, 3 עמודי הירו שיווקיים ודף הבית — ב-Page Builder (טיוטה + פרסום)
 *
 * יעד שאינו מקומי דורש --confirm-production=baitvagan (בנוסף ל-DATABASE_URL).
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { describeTarget } from './seed-guard';
import { composeVariantName } from '@/lib/variants';
import { parseBlocks, type Block } from '@/lib/page-blocks';
import { HOME_KEY, editorState, publishDraft, saveDraft, type LayoutTarget } from '@/lib/page-builder-admin';

const SUBDOMAIN = 'baitvagan';
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');

const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;
const IMAGES = {
  heroPlants: img('photo-1785964165816-95e058839a26'),
  nursery: img('photo-1785964165946-ba4a58eebcb6'),
  heroFlowers: img('photo-1776705413732-0ad2b2b364e3'),
  heroGarden: img('photo-1555955207-b96159c16808'),
  pots: img('photo-1787879748294-f0e07721eb87', 900),
  terracotta: img('photo-1785964165803-8440023bb38c', 900),
  soil: img('photo-1759421278715-46af1a751aba', 900),
  compost: img('photo-1611843467160-25afb8df1074', 900),
  fertilizer: img('photo-1712912828041-7a1246802aa8', 900),
  gloves: img('photo-1622383563227-04401ab4e5ea', 900),
  tools: img('photo-1712912828205-f638eb456766', 900),
  flowerPots: img('photo-1785516903457-0e0bce232623', 1200),
  balcony: img('photo-1785293130567-a18f6c85d370', 1200),
  petunias: img('photo-1773371921674-b8769d292ba6', 1200),
};

const COLORS = {
  primary: '#1F3D2B',
  accent: '#E07B39',
  background: '#F3EAD8',
};

// ---------- קטגוריות ----------

const ROOTS = [
  { slug: 'plants', name: 'צמחים', sortOrder: 1 },
  { slug: 'flowers', name: 'פרחים', sortOrder: 2 },
  { slug: 'garden-supplies', name: 'מוצרי גינון', sortOrder: 3 },
] as const;

/** קטגוריות-על קיימות (ללא הורה) שעוברות תחת קטגוריית-על חדשה */
const MOVE_UNDER: Record<string, (typeof ROOTS)[number]['slug']> = {
  'שיחים': 'plants',
  'עצים': 'plants',
  'מטפסים': 'plants',
  'רב-שנתיים עשבוניים': 'plants',
  'צמחי בשר וקקטוסים': 'plants',
  'צמחי תבלין וריח': 'plants',
  'דשא ודגניים': 'plants',
  'צמחי בית ומיוחדים': 'plants',
  'עונתיים': 'flowers',
  'הדברה': 'garden-supplies',
};

/** תתי-קטגוריות (נוצרות אם אין קטגוריה בשם הזה) */
const SUBS: Array<{ name: string; slug: string; parent: (typeof ROOTS)[number]['slug']; sortOrder: number }> = [
  { name: 'שיחים', slug: 'shrubs', parent: 'plants', sortOrder: 1 },
  { name: 'עצים', slug: 'trees', parent: 'plants', sortOrder: 2 },
  { name: 'מטפסים', slug: 'climbers', parent: 'plants', sortOrder: 3 },
  { name: 'צמחי תבלין וריח', slug: 'herbs', parent: 'plants', sortOrder: 4 },
  { name: 'צמחי בשר וקקטוסים', slug: 'succulents', parent: 'plants', sortOrder: 5 },
  { name: 'ורדים', slug: 'roses', parent: 'flowers', sortOrder: 1 },
  { name: 'עונתיים', slug: 'seasonal', parent: 'flowers', sortOrder: 2 },
  { name: 'פרחים רב-שנתיים', slug: 'perennial-flowers', parent: 'flowers', sortOrder: 3 },
  { name: 'עציצים ואדניות', slug: 'pots', parent: 'garden-supplies', sortOrder: 1 },
  { name: 'אדמה ודשנים', slug: 'soil-fertilizer', parent: 'garden-supplies', sortOrder: 2 },
  { name: 'כלי עבודה', slug: 'tools', parent: 'garden-supplies', sortOrder: 3 },
  { name: 'הדברה', slug: 'pest-control', parent: 'garden-supplies', sortOrder: 4 },
];

// ---------- מוצרים ----------

interface V {
  size?: string;
  color?: string;
  hex?: string;
  price: number;
  stock: number;
}

interface ProductSpec {
  /** צמח מהקטלוג המרכזי (hebrew_name מדויק) / ציוד (title מדויק) / מוצר מותאם */
  plant?: string;
  supply?: string;
  title?: string;
  category: string;
  price: number;
  stock?: number;
  image?: string;
  description?: string;
  optionLabel?: string;
  option2Label?: string;
  variants?: V[];
}

const sizes = (list: Array<[string, number]>, colors: Array<[string, string]> | null, stock = 6): V[] =>
  list.flatMap(([size, price]) => (colors ? colors.map(([color, hex]) => ({ size, color, hex, price, stock })) : [{ size, price, stock }]));
const colorsOnly = (price: number, colors: Array<[string, string]>, stock = 20): V[] => colors.map(([color, hex]) => ({ size: color, hex, price, stock }));

const PRODUCTS: ProductSpec[] = [
  // צמחים
  { plant: 'זית אירופי', category: 'עצים', price: 89, optionLabel: 'גודל', variants: sizes([['4 ליטר', 89], ['10 ליטר', 189], ['25 ליטר', 390]], null, 4) },
  { plant: 'הדר הלימון', category: 'עצים', price: 129, optionLabel: 'גודל', variants: sizes([['10 ליטר', 129], ['25 ליטר', 290]], null, 4) },
  { plant: 'רוזמרין רפואי', category: 'צמחי תבלין וריח', price: 24, stock: 30 },
  { plant: 'בת - קורנית פשוטה ("טימין")', category: 'צמחי תבלין וריח', price: 19, stock: 30 },
  { plant: 'מרווה צחורה', category: 'שיחים', price: 35, stock: 15 },
  { plant: "הדס מצוי 'מגוון'", category: 'שיחים', price: 45, stock: 12 },
  { plant: "פיקוס השדרות 'גרין-איילנד'", category: 'שיחים', price: 85, stock: 8 },
  { plant: 'אגבה רכה', category: 'צמחי בשר וקקטוסים', price: 69, stock: 10 },
  { plant: 'אלוי -מינים שונים', category: 'צמחי בשר וקקטוסים', price: 39, stock: 14 },
  {
    plant: 'בוגנווילאה נאה',
    category: 'מטפסים',
    price: 69,
    optionLabel: 'גודל',
    option2Label: 'צבע',
    variants: sizes([['3 ליטר', 69], ['10 ליטר', 149]], [['סגול', '#8E2C8A'], ['כתום', '#E9853A'], ['לבן', '#F7F4EE']], 5),
  },
  { plant: 'יסמין רפואי', category: 'מטפסים', price: 59, stock: 10 },
  {
    plant: 'היביסקוס סיני',
    category: 'שיחים',
    price: 69,
    optionLabel: 'צבע',
    variants: colorsOnly(69, [['אדום', '#C8102E'], ['ורוד', '#E75480'], ['צהוב', '#F2C230']], 6),
  },
  // פרחים
  {
    plant: 'ורדים אנגליים',
    category: 'ורדים',
    price: 79,
    optionLabel: 'גודל עציץ',
    option2Label: 'צבע',
    variants: sizes([['3 ליטר', 79], ['7 ליטר', 129]], [['אדום', '#B3123A'], ['ורוד', '#F29BB3'], ['לבן', '#FAF7F0'], ['צהוב', '#F5CF47']], 4),
  },
  {
    plant: 'פטוניית x מכלוא',
    category: 'עונתיים',
    price: 12,
    optionLabel: 'צבע',
    variants: colorsOnly(12, [['סגול', '#6B2C91'], ['ורוד', '#EC6FA6'], ['לבן', '#FAFAF5'], ['אדום', '#C8102E']], 40),
  },
  {
    plant: 'סיגל x אמנון ותמר זני מכלוא',
    category: 'עונתיים',
    price: 9,
    optionLabel: 'צבע',
    variants: colorsOnly(9, [['סגול', '#5B2A86'], ['צהוב', '#F4D03F'], ['כתום', '#E67E22']], 50),
  },
  { plant: 'לוע ארי ננסי נשפך', category: 'עונתיים', price: 12, stock: 40 },
  { plant: 'פרג מזרחי', category: 'עונתיים', price: 14, stock: 25 },
  { plant: "גרניום מכלוא קנטברידג'", category: 'פרחים רב-שנתיים', price: 25, stock: 20 },
  { plant: 'ציפורן סיני', category: 'פרחים רב-שנתיים', price: 15, stock: 30 },
  {
    plant: 'גרברה עדינה',
    category: 'פרחים רב-שנתיים',
    price: 29,
    optionLabel: 'צבע',
    variants: colorsOnly(29, [['כתום', '#F28C28'], ['ורוד', '#F06292'], ['צהוב', '#FBC02D']], 12),
  },
  { plant: "כלנית לבידה 'רוז ביוטי'", category: 'פרחים רב-שנתיים', price: 22, stock: 18 },
  // מוצרי גינון
  {
    title: 'עציץ מעוצב לבית',
    category: 'עציצים ואדניות',
    price: 39,
    image: IMAGES.pots,
    description: 'עציץ פלסטיק איכותי עם צלחת תחתונה, עמיד בשמש ומתאים לפנים ולחוץ. זמין בשלושה גדלים ובשלושה צבעים.',
    optionLabel: 'גודל',
    option2Label: 'צבע',
    variants: sizes([['קטן (16 ס"מ)', 39], ['בינוני (24 ס"מ)', 59], ['גדול (35 ס"מ)', 89]], [['ירוק כהה', '#1F3D2B'], ['כתום', '#E07B39'], ["בז'", '#E8DCC4']], 10),
  },
  {
    supply: 'עציץ טרה-קוטה 30 ס"מ',
    category: 'עציצים ואדניות',
    price: 45,
    image: IMAGES.terracotta,
    optionLabel: 'קוטר',
    variants: sizes([['20 ס"מ', 29], ['30 ס"מ', 45], ['40 ס"מ', 79]], null, 10),
  },
  {
    supply: 'אדנית מלבנית 60 ס"מ',
    category: 'עציצים ואדניות',
    price: 45,
    image: IMAGES.flowerPots,
    optionLabel: 'צבע',
    variants: colorsOnly(45, [['לבן', '#F5F5F0'], ['אנתרציט', '#3A3F44'], ['טרה-קוטה', '#C8643B']], 12),
  },
  { supply: 'אדמת שתילה מועשרת 50 ליטר', category: 'אדמה ודשנים', price: 39, stock: 40, image: IMAGES.soil },
  { supply: 'קומפוסט אורגני 40 ליטר', category: 'אדמה ודשנים', price: 35, stock: 30, image: IMAGES.compost },
  { supply: 'דשן NPK מאוזן 1 ק"ג', category: 'אדמה ודשנים', price: 32, stock: 25, image: IMAGES.fertilizer },
  { supply: 'תרסיס נגד כנימות 500 מ"ל', category: 'הדברה', price: 38, stock: 20, image: IMAGES.balcony },
  { supply: 'מזמרה מקצועית ByPass', category: 'כלי עבודה', price: 89, stock: 10, image: IMAGES.tools },
  {
    supply: 'כפפות גינון מצופות ניטריל',
    category: 'כלי עבודה',
    price: 19,
    image: IMAGES.gloves,
    optionLabel: 'מידה',
    option2Label: 'צבע',
    variants: sizes([['S', 19], ['M', 19], ['L', 19]], [['ירוק', '#2E7D32'], ['כתום', '#EF6C00']], 15),
  },
  { supply: 'משפך השקיה מתכוונן 10 ליטר', category: 'כלי עבודה', price: 59, stock: 8, image: IMAGES.heroGarden },
];

// ---------- בלוג ----------

const POSTS = [
  {
    slug: 'choosing-a-pot',
    title: 'איך בוחרים עציץ נכון לצמח?',
    excerpt: 'גודל, חומר וניקוז — שלושה דברים שכדאי לבדוק לפני שמעבירים צמח לעציץ חדש.',
    cover: IMAGES.pots,
    html: '<p>עציץ טוב הוא חצי מהצלחה. בחרו עציץ גדול ב-2–4 ס"מ מהקודם, עם חורי ניקוז בתחתית.</p><h2>חומר העציץ</h2><p>טרה-קוטה נושם ומתאים לצמחים שאוהבים להתייבש בין השקיות; פלסטיק שומר לחות לאורך זמן.</p><h2>ניקוז</h2><p>שכבה דקה של טוף בתחתית ואדמת שתילה איכותית יעזרו לשורשים להישאר בריאים.</p>',
  },
  {
    slug: 'winter-flowers',
    title: 'פרחי חורף: מה לשתול עכשיו?',
    excerpt: 'פטוניות, אמנון ותמר ולוע ארי — הפרחים שיצבעו לכם את המרפסת כל החורף.',
    cover: IMAGES.petunias,
    html: '<p>החורף הוא זמן מצוין לשתילת פרחים עונתיים. הם אוהבים שמש ישירה ומעט מים.</p><ul><li>פטוניה — פריחה שופעת בכמה צבעים</li><li>אמנון ותמר — עמיד בקור ופורח עד האביב</li><li>לוע ארי — מושלם לאדניות</li></ul>',
  },
  {
    slug: 'watering-mistakes',
    title: '5 טעויות השקיה נפוצות',
    excerpt: 'יותר צמחים מתים מעודף מים מאשר מצמא. כך תשקו נכון בכל עונה.',
    cover: IMAGES.compost,
    html: '<p>הטעות הנפוצה ביותר היא השקיה לפי לוח זמנים במקום לפי הצורך. בדקו את האדמה באצבע — אם היא לחה בעומק 2 ס"מ, אין צורך להשקות.</p><p>השקו בבוקר, ישירות לאדמה ולא על העלים, ותנו למים לצאת מהניקוז.</p>',
  },
];

// ---------- עמודים ובלוקים ----------

function block<T extends Block['type']>(type: T, fields: Record<string, unknown>): Record<string, unknown> {
  return { type, hideOnMobile: false, hideOnDesktop: false, ...fields };
}

function validated(raw: Record<string, unknown>[], label: string): Block[] {
  const r = parseBlocks(raw);
  if (!r.ok) throw new Error(`${label}: ${r.error}`);
  return r.value;
}

const PAGES = [
  {
    slug: 'plants',
    title: 'צמחים לבית ולגינה',
    root: 'plants',
    hero: IMAGES.heroPlants,
    headline: 'צמחים שגדלים איתכם',
    sub: 'עצים, שיחים, מטפסים וצמחי תבלין — מגודלים במשתלה ומוכנים לשתילה בגינה ובמרפסת.',
    cta: 'לכל הצמחים',
    about: {
      title: 'מגודל אצלנו, נבחר בשבילכם',
      html: '<p>כל צמח במשתלה עובר הקשחה ובדיקה לפני שהוא יוצא אליכם. נשמח לייעץ איזה צמח מתאים לשמש, לצל ולגודל המרפסת שלכם.</p>',
      image: IMAGES.nursery,
    },
    faq: [
      { q: 'איך יודעים איזה צמח מתאים לי?', a: 'בדף כל צמח מופיעים דרישות האור, ההשקיה והגודל הצפוי. אפשר גם להתקשר — נשמח לעזור.' },
      { q: 'מה ההבדל בין הגדלים?', a: 'הגודל הוא נפח העציץ שבו הצמח גדל. עציץ גדול = צמח בוגר יותר שייראה מלא כבר מהיום הראשון.' },
      { q: 'אפשר לאסוף מהמשתלה?', a: 'כן — מזמינים באתר ואוספים מהמשתלה. התשלום באיסוף.' },
    ],
  },
  {
    slug: 'flowers',
    title: 'פרחים',
    root: 'flowers',
    hero: IMAGES.heroFlowers,
    headline: 'צבע לכל עונה',
    sub: 'ורדים, פרחי עונה ופרחים רב-שנתיים במגוון צבעים — בוחרים צבע וגודל ואוספים מהמשתלה.',
    cta: 'לכל הפרחים',
    about: {
      title: 'בוחרים את הצבע שלכם',
      html: '<p>לרוב הפרחים יש כמה צבעים לבחירה. בחרו בדף המוצר את הצבע והגודל, ואנחנו נכין לכם את השתילים.</p>',
      image: IMAGES.flowerPots,
    },
    faq: [
      { q: 'מתי שותלים פרחי עונה?', a: 'פרחי חורף שותלים בסתיו, ופרחי קיץ באביב. בכל עונה תמצאו אצלנו את מה שמתאים לשתילה עכשיו.' },
      { q: 'כמה שמש צריכים הפרחים?', a: 'רוב הפרחים העונתיים אוהבים שמש מלאה לפחות 5 שעות ביום.' },
    ],
  },
  {
    slug: 'garden',
    title: 'מוצרי גינון',
    root: 'garden-supplies',
    hero: IMAGES.heroGarden,
    headline: 'כל מה שהגינה צריכה',
    sub: 'עציצים ואדניות, אדמה ודשנים, כלי עבודה ותכשירים — באיכות מקצועית ובמחירי משתלה.',
    cta: 'לכל מוצרי הגינון',
    about: {
      title: 'עציצים בגדלים ובצבעים',
      html: '<p>העציצים שלנו זמינים בכמה גדלים ובשלושה צבעים — ירוק כהה, כתום ובז\'. בחרו בדף המוצר את השילוב שמתאים לבית שלכם.</p>',
      image: IMAGES.pots,
    },
    faq: [
      { q: 'איזו אדמה מתאימה לעציצים?', a: 'אדמת שתילה מועשרת מתאימה לרוב הצמחים בעציץ. לצמחי בשר ערבבו מעט טוף לניקוז.' },
      { q: 'כל כמה זמן לדשן?', a: 'בעונת הגידול (אביב–קיץ) פעם בחודש עם דשן מאוזן, ובחורף אפשר לוותר.' },
    ],
  },
] as const;

// ---------- הרצה ----------

function log(...m: unknown[]) {
  console.log(DRY ? '[dry-run]' : '', ...m);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL לא מוגדרת');
  const target = describeTarget(url);
  if (!target.local && !args.includes(`--confirm-production=${SUBDOMAIN}`)) {
    throw new Error(`יעד ${target.ref ?? target.host} אינו מקומי — נדרש --confirm-production=${SUBDOMAIN}`);
  }
  log('יעד:', target.local ? `local:${target.host}` : `supabase:${target.ref}`);

  const db = new PrismaClient({ log: ['warn', 'error'] });
  try {
    let nursery = await db.nursery.findUnique({ where: { subdomain: SUBDOMAIN } });
    if (!nursery) {
      if (!target.local) throw new Error('המשתלה לא נמצאה ב-Production');
      log('משתלה לא קיימת (מקומי) — נוצרת');
      if (!DRY) nursery = await db.nursery.create({ data: { name: 'משתלת בית וגן', subdomain: SUBDOMAIN, ownerEmail: `owner@${SUBDOMAIN}.invalid` } });
      else return;
    }
    const nurseryId = nursery!.id;
    const run = async (label: string, fn: () => Promise<unknown>) => {
      log(label);
      if (!DRY) await fn();
    };

    // עיצוב — ממוזג; שאר ההגדרות (Hero ישן, קרוסלה) נשמרות
    const theme = (nursery!.themeConfig ?? {}) as Record<string, unknown>;
    await run('עיצוב: צבעים, סרגל צף, הודעת סטיקי', () =>
      db.nursery.update({
        where: { id: nurseryId },
        data: {
          primaryColor: COLORS.primary,
          pickupEnabled: true,
          themeConfig: {
            ...theme,
            colors: COLORS,
            stickyHeader: true,
            headerStyle: 'float',
            announcement: {
              enabled: true,
              text: 'פרחי העונה הגיעו למשתלה · הזמינו באתר ואספו מהמשתלה',
              linkText: 'לפרחים',
              href: '/flowers',
              tone: 'brand',
            },
          } as Prisma.InputJsonValue,
        },
      }),
    );

    // מודולים
    const modules: Array<[string, Record<string, unknown> | null]> = [
      ['sales', { mode: 'ONLINE' }],
      ['orders', null],
      ['promotions', null],
      ['page_builder', null],
      ['static_pages', null],
      ['blog', null],
      ['design', { colors: true, hero: true, carousel: true, popup: false, sticky: true }],
    ];
    for (const [moduleKey, config] of modules) {
      await run(`מודול ${moduleKey}: פעיל`, () =>
        db.nurseryModule.upsert({
          where: { nurseryId_moduleKey: { nurseryId, moduleKey } },
          create: { nurseryId, moduleKey, isEnabled: true, ...(config ? { config: config as Prisma.InputJsonValue } : {}) },
          // מכירה: גם המצב (שורה קיימת עשויה להיות במצב "הצעת מחיר")
          update: { isEnabled: true, ...(moduleKey === 'sales' ? { config: config as Prisma.InputJsonValue } : {}) },
        }),
      );
    }
    await run('תשלום באיסוף מהמשתלה: פעיל', () =>
      db.nurseryPaymentMethod.upsert({
        where: { nurseryId_method: { nurseryId, method: 'PAY_ON_PICKUP' } },
        create: { nurseryId, method: 'PAY_ON_PICKUP', isEnabled: true, instructions: 'התשלום במשתלה בעת האיסוף (מזומן / אשראי / ביט).' },
        update: { isEnabled: true },
      }),
    );

    // קטגוריות
    const rootIds: Record<string, string> = {};
    for (const r of ROOTS) {
      const existing = await db.nurseryCategory.findUnique({ where: { nurseryId_slug: { nurseryId, slug: r.slug } } });
      if (existing) rootIds[r.slug] = existing.id;
      else {
        log(`קטגוריית-על חדשה: ${r.name}`);
        rootIds[r.slug] = DRY ? `dry-${r.slug}` : (await db.nurseryCategory.create({ data: { nurseryId, ...r } })).id;
      }
    }
    const all = await db.nurseryCategory.findMany({ where: { nurseryId } });
    for (const c of all) {
      const to = MOVE_UNDER[c.name];
      if (to && !c.parentId) await run(`"${c.name}" עוברת תחת "${ROOTS.find((r) => r.slug === to)!.name}"`, () => db.nurseryCategory.update({ where: { id: c.id }, data: { parentId: rootIds[to] } }));
    }
    const byName = new Map(all.map((c) => [c.name, c.id]));
    for (const s of SUBS) {
      if (byName.has(s.name)) continue;
      const slugTaken = await db.nurseryCategory.findUnique({ where: { nurseryId_slug: { nurseryId, slug: s.slug } } });
      const slug = slugTaken ? `${s.slug}-${s.parent}` : s.slug;
      log(`תת-קטגוריה חדשה: ${s.name}`);
      if (!DRY) byName.set(s.name, (await db.nurseryCategory.create({ data: { nurseryId, name: s.name, slug, parentId: rootIds[s.parent], sortOrder: s.sortOrder } })).id);
    }

    // מוצרים
    let created = 0;
    for (const p of PRODUCTS) {
      const plant = p.plant ? await db.plant.findFirst({ where: { hebrewName: p.plant }, select: { id: true } }) : null;
      const supply = p.supply ? await db.masterSupply.findFirst({ where: { title: p.supply }, select: { id: true } }) : null;
      if ((p.plant && !plant) || (p.supply && !supply)) {
        log(`דילוג — לא נמצא בקטלוג המרכזי: ${p.plant ?? p.supply}`);
        continue;
      }
      const existing = await db.nurseryProduct.findFirst({
        where: plant ? { nurseryId, plantId: plant.id } : supply ? { nurseryId, supplyId: supply.id } : { nurseryId, customTitle: p.title },
        select: { id: true, customImageUrl: true, _count: { select: { categories: true } } },
      });
      const categoryId = byName.get(p.category);
      if (existing) {
        // מוצר קיים: רק משלימים שדות ריקים (תמונה, קטגוריה) — מחיר, מלאי וסטטוס לא משתנים
        const fill = {
          ...(p.image && !existing.customImageUrl ? { customImageUrl: p.image } : {}),
          ...(categoryId && existing._count.categories === 0 ? { categories: { create: [{ nurseryCategoryId: categoryId }] } } : {}),
        };
        log(`קיים${Object.keys(fill).length ? ` — משלימים: ${Object.keys(fill).join(', ')}` : ' — לא משתנה'}: ${p.plant ?? p.supply ?? p.title}`);
        if (!DRY && Object.keys(fill).length) await db.nurseryProduct.update({ where: { id: existing.id }, data: fill });
        continue;
      }
      log(`מוצר חדש: ${p.plant ?? p.supply ?? p.title}${p.variants ? ` (${p.variants.length} וריאנטים)` : ''}`);
      if (DRY) continue;
      const minPrice = Math.min(...(p.variants ?? [{ price: p.price }]).map((v) => v.price));
      const product = await db.nurseryProduct.create({
        data: {
          nurseryId,
          plantId: plant?.id ?? null,
          supplyId: supply?.id ?? null,
          customTitle: p.title ?? null,
          customImageUrl: p.image ?? null,
          customDescription: p.description ?? null,
          price: minPrice.toFixed(2),
          stockQuantity: p.variants ? 0 : (p.stock ?? 10),
          isActive: true,
          optionLabel: p.optionLabel ?? null,
          option2Label: p.option2Label ?? null,
          ...(categoryId ? { categories: { create: [{ nurseryCategoryId: categoryId }] } } : {}),
        },
      });
      if (p.variants) {
        // ה-trigger יוצר וריאנט ברירת מחדל — הוא הופך לשילוב הראשון
        const def = await db.productVariant.findFirstOrThrow({ where: { nurseryProductId: product.id, isDefault: true } });
        for (const [i, v] of p.variants.entries()) {
          const data = {
            name: composeVariantName(v.size, v.color),
            option1: v.size ?? null,
            option2: v.color ?? null,
            colorHex: v.hex ?? null,
            price: v.price === minPrice ? null : v.price.toFixed(2),
            stockQuantity: v.stock,
            sortOrder: i,
          };
          if (i === 0) await db.productVariant.update({ where: { id: def.id }, data });
          else await db.productVariant.create({ data: { ...data, nurseryId, nurseryProductId: product.id } });
        }
      }
      created++;
    }
    log(`מוצרים חדשים: ${created}`);

    // בלוג
    for (const post of POSTS) {
      const exists = await db.blogPost.findUnique({ where: { nurseryId_slug: { nurseryId, slug: post.slug } } });
      if (exists) continue;
      await run(`פוסט: ${post.title}`, () =>
        db.blogPost.create({
          data: { nurseryId, slug: post.slug, title: post.title, excerpt: post.excerpt, coverImageUrl: post.cover, contentHtml: post.html, isPublished: true, publishedAt: new Date() },
        }),
      );
    }

    // עמודי הירו
    const pageIds: Record<string, string> = {};
    for (const [i, pg] of PAGES.entries()) {
      const exists = await db.staticPage.findUnique({ where: { nurseryId_slug: { nurseryId, slug: pg.slug } } });
      if (exists) pageIds[pg.slug] = exists.id;
      else {
        log(`עמוד: ${pg.title}`);
        if (!DRY)
          pageIds[pg.slug] = (
            await db.staticPage.create({
              data: { nurseryId, slug: pg.slug, title: pg.title, contentHtml: `<p>${pg.sub}</p>`, isPublished: true, showInNav: true, sortOrder: 10 + i, seoMetaDescription: pg.sub },
            })
          ).id;
      }
    }
    if (DRY) return;

    const subLinks = (root: string) =>
      all
        .filter((c) => c.parentId && c.parentId === rootIds[root])
        .map((c) => c.id)
        .concat(SUBS.filter((s) => s.parent === root).flatMap((s) => (byName.has(s.name) ? [byName.get(s.name)!] : [])));

    for (const pg of PAGES) {
      const blocks = validated(
        [
          block('hero', { variant: 'image', imageUrl: pg.hero, headline: pg.headline, subheadline: pg.sub, ctaText: pg.cta, ctaHref: `/catalog?category=${pg.root}` }),
          block('categories', { title: 'קנו לפי סוג', categoryIds: Array.from(new Set(subLinks(pg.root))).slice(0, 8) }),
          block('products', { title: 'הנמכרים ביותר', source: 'category', categoryId: rootIds[pg.root], limit: 8, showCategory: true }),
          block('imageText', { imageUrl: pg.about.image, title: pg.about.title, html: pg.about.html, imageSide: 'right', ctaText: 'צרו קשר', ctaHref: '/contact' }),
          block('faq', { title: 'שאלות נפוצות', items: pg.faq }),
          block('cta', { title: 'מזמינים באתר — אוספים מהמשתלה', text: 'ההזמנה מוכנה לאיסוף, והתשלום במשתלה.', ctaText: pg.cta, ctaHref: `/catalog?category=${pg.root}`, tone: 'brand' }),
        ],
        pg.title,
      );
      await publishIfChanged(db, nurseryId, { kind: 'page', staticPageId: pageIds[pg.slug]! }, blocks, pg.title);
    }

    const home = validated(
      [
        block('hero', {
          variant: 'carousel',
          headline: 'משתלת בית וגן',
          subheadline: 'צמחים, פרחים ומוצרי גינון',
          ctaText: 'לכל הקטלוג',
          ctaHref: '/catalog',
          slides: PAGES.map((pg) => ({ imageUrl: pg.hero, headline: pg.headline, subheadline: pg.sub, ctaText: pg.cta, ctaHref: `/${pg.slug}` })),
        }),
        block('categories', { title: 'מה מחפשים היום?', categoryIds: ROOTS.map((r) => rootIds[r.slug]) }),
        block('products', { title: 'מבחר מהמשתלה', source: 'mixed', limit: 8, showCategory: true }),
        block('cta', { title: 'לא בטוחים מה לבחור?', text: 'ספרו לנו כמה שמש יש במרפסת או בגינה, ונמליץ על הצמחים שיצליחו אצלכם.', ctaText: 'דברו איתנו', ctaHref: '/contact', tone: 'light' }),
        block('contentCards', { title: 'מדריכים וטיפים מהמשתלה', source: 'blog', limit: 3 }),
        block('contact', { title: 'בואו לבקר במשתלה', showHours: true, showPhone: true, showAddress: true }),
      ],
      'דף הבית',
    );
    await publishIfChanged(db, nurseryId, { kind: 'home' }, home, 'דף הבית');
    log('סיום ✓');
  } finally {
    await db.$disconnect();
  }
}

/** שומר טיוטה ומפרסם — רק אם עדיין לא פורסמה גרסה (לא דורס עבודה של הבעלים ב-Page Builder). */
async function publishIfChanged(db: PrismaClient, nurseryId: string, target: LayoutTarget, blocks: Block[], label: string) {
  const state = await editorState(db, nurseryId, target);
  if (state.versions.length > 0) {
    log(`${label}: כבר יש גרסה שפורסמה — לא משתנה`);
    return;
  }
  await saveDraft(db, nurseryId, target, blocks);
  await publishDraft(db, nurseryId, target, new Date(), 'seed:beit-vagan');
  log(`${label}: פורסם (${blocks.length} בלוקים)${target.kind === 'home' ? ` [${HOME_KEY}]` : ''}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
