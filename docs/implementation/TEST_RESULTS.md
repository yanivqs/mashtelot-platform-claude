# תוצאות בדיקות

כל הרצה כוללת: תאריך, ענף/קומיט, סביבה, פקודה ותוצאה. אף הרצה אינה מול Production.

## 2026-10-16 — E01 (ענף `chore/e01-test-isolation`)

| # | בדיקת קבלה | פקודה / סביבה | תוצאה |
|---|---|---|---|
| 1 | בדיקות יחידה עוברות ללא שום משתנה DB | `env -u DATABASE_URL -u DIRECT_URL -u TEST_DATABASE_URL npx vitest run` | ✅ 6 קבצים, **47/47** (37 קיימות + 10 של ה-guard) |
| 2 | `test:db` ללא `TEST_DATABASE_URL` נכשל לפני כל שאילתה | `TEST_DATABASE_URL="" vitest -c vitest.db.config.ts` | ✅ exit 1, `UnsafeTestDatabaseError`, `migrate reset` לא הורץ |
| 3 | `test:db` מול ref של Production נכשל — גם כשהוא ברשימת ההיתר | כתובת מזויפת עם ref `wkcumchuuhmaonrjuvsz` וסיסמה מזויפת | ✅ exit 1, "מצביעה לפרויקט ה-Production"; לא נוצר חיבור |
| 4 | יעד מקומי שאינו `*_test` נדחה | `postgresql://…@localhost/postgres` | ✅ exit 1 |
| 5 | ריצה מלאה מול בסיס בדיקות מקומי | `npx vitest run -c vitest.db.config.ts` · `local:mashtelot_test` | ✅ reset + 16 מיגרציות; **10/10** (smoke 7 + fixtures 3) |
| 6 | Prisma Client מחובר ליעד המאומת | `fixtures.test.ts` — `current_database()` | ✅ `mashtelot_test` |
| 7 | אין שאריות נתונים אחרי הריצה | psql: `nurseries`, `users`, `orders` | ✅ 0 / 0 / 0 |
| 8 | Typecheck | `tsc --noEmit` | ✅ exit 0 |

**לא נבדק:** `test:db` מול `mashtelot-dev` (ראו IMPLEMENTATION_PROGRESS). `next build` לא הורץ — השינוי אינו נוגע בקוד האפליקציה.

## 2026-10-16 — C-P0-01 (ענף `fix/c-p0-01-static-pages-idor`)

| # | בדיקה | סביבה | לפני התיקון (`c47d4ab`) | אחרי התיקון |
|---|---|---|---|---|
| 1 | A לא יכולה לדרוס את עמוד B (תוכן, slug, nurseryId ללא שינוי) | local:mashtelot_test | ❌ נכשל — הדריסה הצליחה | ✅ |
| 2 | A לא יכולה למחוק את עמוד B | 〃 | ✅ (המחיקה כבר הייתה מסוננת) | ✅ |
| 3 | מזהה עמוד לא קיים נדחה ולא יוצר כלום | 〃 | ❌ | ✅ |
| 4 | רגרסיה: A מעדכנת עמוד שלה | 〃 | ✅ | ✅ |
| 5 | רגרסיה: A יוצרת עמוד (גם עם slug ש-B משתמשת בו) | 〃 | ✅ | ✅ |
| 6 | רגרסיה: ייחודיות slug בתוך משתלה | 〃 | ✅ | ✅ |
| 7 | רגרסיה: A מוחקת עמוד שלה | 〃 | ✅ | ✅ |

- סוויטת DB מלאה: **17/17** (smoke 7 + fixtures 3 + isolation 7).
- יחידה: **47/47**. `tsc --noEmit`: ✅. `next build`: ✅.
- הערה: `next build` המקומי קרא (קריאה בלבד) מבסיס ה-Production בזמן prerender — ראו S-14.
- **לא נבדק:** בדיקה ידנית בממשק (Server Action דרך הדפדפן) — לא הורץ שרת מקומי.

## 2026-10-16 — C-P0-02 (ענף `fix/c-p0-02-rls`)

| # | בדיקה | לפני (`026f56e`, dev) | אחרי — local | אחרי — dev Supabase |
|---|---|---|---|---|
| 1 | אין טבלה ב-public בלי RLS | ❌ 12 טבלאות | ✅ | ✅ |
| 2 | anon לא קורא שורות | ❌ `_prisma_migrations` (16), `blog_posts` (3) | ↓ דולג (אין תפקיד) | ✅ |
| 3 | anon לא כותב/מוחק | ❌ `audit_events` INSERT, `blog_posts` DELETE, `_prisma_migrations` DELETE | ↓ | ✅ |
| 4 | authenticated לא קורא | ❌ | ↓ | ✅ |
| 5 | authenticated לא כותב/מוחק | ❌ | ↓ | ✅ |
| 6 | רגרסיה: תפקיד האפליקציה קורא/כותב | ✅ | ✅ | ✅ |

- סוויטה מלאה: local **20 + 4 דולגו**; dev Supabase **24/24** (כולל smoke, בידוד עמודים, fixtures).
- SQL ב-dev אחרי המיגרציה: 0 הרשאות anon/authenticated בטבלאות public; 0 טבלאות ללא RLS; default ACL ללא anon/authenticated.
- אחרי ה-probes: `_prisma_migrations`=16, ללא שאריות fixtures.
- יחידה: **47/47**.
- **לא נבדק:** קריאה דרך HTTP ל-PostgREST עם המפתח הציבורי (הבדיקה מדמה זאת ב-`SET LOCAL ROLE`, כפי ש-PostgREST עושה); מצב ההרשאות בפרודקשן עצמו (לא נקרא).

## 2026-10-17 — בדיקת Production אחרי פריסת `55d0415` (קריאה בלבד)

| בדיקה | תוצאה |
|---|---|
| Vercel deployment status על הקומיט | ✅ success |
| `/`, `/catalog`, `/catalog?page=2`, `/catalog?light=sun`, `/cart`, `/checkout`, `/contact`, דף מוצר | ✅ 200 (0.38–1.1 שנ׳) |
| דפדוף: עמוד 1 ≠ עמוד 2 | ✅ |
| `/admin` → `/admin/login` | ✅ 307 → 200 |
| **לא נבדק:** שמירת עמוד סטטי ב-Admin החי (דורש התחברות) | — |

## 2026-10-17 — בדיקת Production אחרי פריסת `81dacf0` (C-P0-02)

| בדיקה | תוצאה |
|---|---|
| Vercel deployment status | ✅ success |
| מיגרציה `20261016000000_rls_all_tables_revoke_public_roles` ב-`_prisma_migrations` | ✅ applied + finished |
| טבלאות ב-public ללא RLS | ✅ 0 |
| הרשאות anon/authenticated על טבלאות public | ✅ 0 |
| חנות: בית, קטלוג (62 מוצרים), דפדוף, קטגוריה, מוצר, עגלה, checkout, צור קשר, landing, admin/login | ✅ 200 |
| `/blog` | 404 — צפוי: מודול הבלוג כבוי למשתלת ההדגמה (`blog/page.tsx:27`), לא קשור ל-RLS |
| **לא נבדק:** קריאה ל-Data API של Production עם המפתח הציבורי; Security Advisor בדשבורד (בידי הבעלים) | — |

## 2026-10-17 — C-P0-03 (ענף `fix/c-p0-03-seed-secrets`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | רוטציה בפרודקשן: סיסמה חדשה עובדת / ישנה לא (2 חשבונות) | Production (כתיבה מאושרת, `password_hash` בלבד) | ✅ true / false |
| 2 | התחברות הבעלים עם הסיסמה החדשה אחרי החלפת `AUTH_SECRET` + Redeploy | Production | ✅ (דווח ע"י הבעלים) |
| 3 | `seed-admin.js` מול DATABASE_URL של Production | ללא חיבור | ✅ נחסם |
| 4 | `seed.js` מול Production | ללא חיבור | ✅ נחסם |
| 5 | סיסמה חסרה / קצרה | local | ✅ נדחה |
| 6 | יצירה; הרצה חוזרת בלי `--reset-password` לא משנה סיסמה; עם הדגל — משנה | local | ✅ |
| 7 | החלפת סיסמה: נוכחית שגויה, אי-התאמה, חלשה/חשופה נדחות; הצלחה משנה רק את המשתמש עצמו (B ללא שינוי) | local DB | ✅ 3/3 |
| 8 | יחידה (כולל validateNewPassword + seed guard) | — | ✅ 53/53 |
| 9 | סוויטת DB | local | ✅ 23 + 4 דולגו |
| 10 | `tsc --noEmit` · `next build` | — | ✅ · ✅ |

**לא נבדק:** מסך החלפת הסיסמה בדפדפן (Server Action חי).

## 2026-10-17 — בדיקת Production אחרי פריסת `15ac17d` (C-P0-03)

| בדיקה | תוצאה |
|---|---|
| Vercel deployment status | ✅ success (~90 שנ׳) |
| חנות: בית, קטלוג, דפדוף, checkout · `/admin/login` | ✅ 200 |
| `/admin/account` ללא התחברות | ✅ 307 → login |
| `seed-admin.js` ב-GitHub (raw, ציבורי) מכיל `admin1234` | ✅ 0 מופעים |

## 2026-10-17 — C-P0-05 (ענף `fix/c-p0-05-migration-path`)

| # | תרחיש | תוצאה |
|---|---|---|
| 1 | Production + ערכי `.env` האמיתיים (החלטה בלבד, ללא הרצה) | ✅ generate → migrate → next |
| 2 | Production + בסיס פיתוח | ✅ נכשל (תצורה שגויה) |
| 3 | Preview + Production (התצורה הנוכחית ב-Vercel) | ✅ נחסם |
| 4 | Preview + mashtelot-dev (תצורת היעד) | ✅ migrate → dev |
| 5 | `npm run build` מקומי עם `.env` (Production) — הרצה אמיתית | ✅ exit 1, נחסם לפני כל חיבור |
| 6 | `npm run build` מול בסיס הבדיקות המקומי — הרצה אמיתית | ✅ build עבר, ללא מיגרציות |
| 7 | יחידה (כולל 5 בדיקות `scripts/build.test.ts`) · tsc | ✅ 58/58 · ✅ |

**הנחה שלא נבדקה ישירות:** ערכי Production ב-Vercel באותו פורמט כמו `.env` (אותו מקור). אם לא — ה-build של Production ייכשל (האתר נשאר על הפריסה הקודמת), לא ייפרס בשקט.

## 2026-10-18 — בדיקת Production אחרי פריסת `e45fa46` (C-P0-05)

| בדיקה | תוצאה |
|---|---|
| Vercel deployment status | ✅ success (~75 שנ׳) — מאשר שמסלול ה-production נבחר והפורמט של ערכי Vercel תואם (כל מסלול אחר היה נכשל מול בסיס ה-Production) |
| חנות: בית, קטלוג, דפדוף, checkout, צור קשר · `/admin/login` | ✅ 200 |
| **ממתין:** הפרדת משתני Preview ב-Vercel (בעלים), ואז build Preview מוצלח מול mashtelot-dev | — |

## 2026-10-18 — אימות Preview (C-P0-05)

| ניסיון | תוצאה | סיבה |
|---|---|---|
| 1–2 | ❌ נכשל ב-~45 שנ׳ | `[build] DATABASE_URL אינה כתובת תקינה` — ערך Preview הודבק עם תווים עודפים |
| סימולציה מקומית (`VERCEL_ENV=preview` + ערכי dev) | ✅ | הקוד תקין: מסלול preview → `xsjwnqltgckkyycicqlc`, אין מיגרציות ממתינות, build עבר |
| 3 (אחרי תיקון הערך ב-Vercel) | ✅ success (~135 שנ׳) | Preview בונה מול mashtelot-dev; מול Production היה נחסם |

ענף הבדיקה `chore/preview-check` נמחק (מקומי + GitHub).

## 2026-10-18 — C-P1-01 (ענף `fix/c-p1-01-nursery-scope`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | החלטת גישה: אנונימי/סופר-אדמין/לקוח/ללא משתלה/מושעית/מודול all-any | יחידה | ✅ 6 |
| 2 | שימור עיצוב כשמודול עיצוב/קרוסלה כבוי | יחידה | ✅ 3 |
| 3 | בעלות ל-8 סוגי רשומות: A שלו ✓, של B ✗, מזהה לא קיים ✗ | local + dev | ✅ 8 |
| 4 | משתלה C מושעית: session מבוטל, כל פעולה נחסמת | local + dev | ✅ |
| 5 | מודול כבוי → חסום; הופעל ל-A → מותר; לא פותח את B | local + dev | ✅ |
| 6 | סופר-אדמין המשויך למשתלה — עדיין ללא גישה תפעולית | local + dev | ✅ |
| 7 | **ריצת אפליקציה בנויה (next start) מול בסיס בדיקות, בקשות HTTP עם session לכל תפקיד:** סופר-אדמין → products/orders/settings/marketing = 307 PLATFORM_ROLE, catalog/account = 200 · בעלים A → products/browse/settings = 200, marketing/orders (מודול כבוי) = 307 MODULE_DISABLED, catalog = 307 · בעלים C (מושעית, session קיים) → כל דף = 307 login | local | ✅ |
| 8 | הודעת ההסבר מוצגת; פרמטר לא מוכר לא מציג באנר | local | ✅ |
| 9 | יחידה · DB (local) · DB (dev Supabase) · tsc · build | — | ✅ 67/67 · 35+4 דולגו · 39/39 · ✅ · ✅ |

**לא נבדק:** קריאה ישירה ל-Server Actions דרך HTTP (נבדקה הלוגיקה שהן קוראות לה); טופס ההתחברות עם משתלה מושעית בדפדפן (הלוגיקה ביחידה).

## 2026-10-18 — בדיקת Production אחרי פריסת `58e3d00` (C-P1-01)

| בדיקה | תוצאה |
|---|---|
| Vercel deployment status | ✅ success (~90 שנ׳) |
| חנות: בית, קטלוג, דפדוף, מוצר, עגלה, checkout, צור קשר | ✅ 200 |
| `/admin`, `/admin/products`, `/admin/orders`, `/admin/account` ללא התחברות | ✅ 307 → login |
| **ממתין:** בדיקה ידנית של הבעלים — התחברות כסופר-אדמין וכבעלי demo | — |

## 2026-10-18 — C-P1-04 (ענף `chore/c-p1-04-ci`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | `next lint` | local | ✅ אין שגיאות/אזהרות (אחרי הגדרה) |
| 2 | Typecheck · Unit · build (כולל lint) | local | ✅ · 67/67 · ✅ |
| 3 | CI: Typecheck · Lint · Unit | GitHub Actions | ✅ 54 שנ׳ |
| 4 | CI: DB integration · Tenant isolation · Build (Postgres 17 זמני) | GitHub Actions | ✅ 93 שנ׳ |
| 5 | **שלילי:** באג מכוון (בדיקת בעלות קופון מתעלמת מהמשתלה) | GitHub Actions | ✅ job ה-DB **נכשל**; ה-job המהיר עבר (צפוי — אין לו DB). הענף נמחק |
| 6 | Preview של הענף ב-Vercel | Vercel | ✅ success |

## 2026-10-18 — C-P1-02 (ענף `feat/c-p1-02-orders-inventory`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | מיגרציות: אין drift מול הסכמה | local | ✅ |
| 2 | המרת הזמנות ישנות (PENDING/PAID/PROCESSING/SHIPPED/CANCELLED/QUOTE) | בסיס זמני | ✅ כל מיפוי נכון |
| 3 | מכונות מצבים + השפעות מלאי + מינימום קופון | יחידה | ✅ 76/76 (כולל 10 חדשות) |
| 4 | 19 בדיקות שירות: שמירה + Snapshot; **שתי הזמנות מקבילות ליחידה אחרונה — אחת מצליחה**; זמין = on_hand − שמור; **idempotency** (רציף, מקבילי, לפי משתלה); פקיעה פעם אחת וההזמנה נשארת פתוחה; אישור אחרי פקיעה שומר מחדש / נכשל כשאין מלאי; מחזור חיים (שליחה מורידה פעם אחת; איסוף); מעברים לא חוקיים; ביטול כפול; ביטול הזמנה ישנה מחזיר on_hand; **B לא משנה הזמנה של A**; סטטוס תשלום; Snapshot + החזרת קופון; מינימום הזמנה; מגבלה ללקוח (כולל rollback); עדכון מלאי ידני | local + dev | ✅ |
| 5 | סוויטת DB מלאה | local / dev Supabase | ✅ 54+4 דולגו / 58/58 (המיגרציות הוחלו ב-dev) |
| 6 | **checkout אמיתי דרך האפליקציה הבנויה (Server Action ב-HTTP):** הזמנה 2 יח׳ → נוצרה; ניסיון חוזר עם אותו מפתח → **אותה הזמנה**; לקוח נוסף 2 יח׳ (נותרה 1) → "אין מספיק מלאי"; DB: on_hand=3, שמור=2, הזמנה אחת, RECEIVED/UNPAID/RESERVED, חלון 48.0 שעות, תנועת RESERVE | local | ✅ |
| 7 | מסך הזמנות (בעלים): מוצגים רק "→ אושרה"/"→ בוטלה"/"→ שולם"; "נשלחה"/"נמסרה" לא מוצעים מ"התקבלה"; תג "מלאי שמור עד" | local | ✅ |
| 8 | שם לקוח בעברית נשמר ב-UTF-8 | local | ✅ |
| 9 | tsc · lint · build | — | ✅ · ✅ · ✅ |

**לא נבדק:** מעבר סטטוס דרך הדפדפן (נבדק בשירות); תצוגת המלאי בחנות החיה.

## 2026-10-18 — בדיקת Production אחרי פריסת `2c76406` (C-P1-02, קריאה בלבד)

| בדיקה | תוצאה |
|---|---|
| CI על main · Vercel Production | ✅ · ✅ (~105 שנ׳) |
| מיגרציות `20261018000000` + `20261018000100` | ✅ הוחלו |
| ההזמנה הקיימת | ✅ RECEIVED / UNPAID / COMMITTED |
| מוצרים | ✅ 70, 1,115 יח׳ במלאי (ללא שינוי), שמור 0 |
| `stock_movements` עם RLS · טבלאות ללא RLS · ברירת מחדל סטטוס | ✅ true · 0 · RECEIVED |
| חנות: בית, קטלוג, checkout, דף מוצר ("במלאי (4 יח')") · `/admin/login` | ✅ 200 |
| **ממתין:** בדיקה ידנית של הבעלים — הזמנת ניסיון ומעברי סטטוס במסך ההזמנות | — |

## 2026-10-18 — C-P1-05 (ענף `feat/c-p1-05-seo-sitemap-robots`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | resolveHost, buildRobots, buildSitemap (עברית, XML, כפילויות) | יחידה | ✅ 5 |
| 2 | robots — חנות: Allow + Disallow ל-admin/api/cart/checkout + Sitemap קנוני | אפליקציה בנויה, local | ✅ |
| 3 | robots — דומיין ראשי · משתלה מושעית · דומיין לא מוכר | 〃 | ✅ תקין · Disallow: / · Disallow: / |
| 4 | robots ב-`VERCEL_ENV=preview` (חנות + ראשי) | 〃 | ✅ Disallow: / |
| 5 | sitemap — 6 כתובות: בית, קטלוג, צור קשר, קטגוריה עם מוצר, מוצר פעיל, עמוד מפורסם; **ללא** מוצר כבוי, טיוטה, קטגוריה ריקה | 〃 | ✅ |
| 6 | כתובת המוצר ב-sitemap נפתחת (200) וזהה ל-canonical של הדף | 〃 | ✅ |
| 7 | sitemap למשתלה מושעית / דומיין לא מוכר | 〃 | ✅ 404 / 404 |
| 8 | תוכן כפול: `/seoshop/catalog` בדומיין הראשי → 404; דף נחיתה, קטלוג ועמוד חנות → 200 | 〃 | ✅ |
| 9 | יחידה · DB local · tsc · lint · build | — | ✅ 81/81 · ✅ · ✅ · ✅ · ✅ |

## 2026-10-18 — בדיקת Production אחרי פריסת `f1c5914` (C-P1-05)

| בדיקה | תוצאה |
|---|---|
| Vercel Production | ✅ success (~105 שנ׳) |
| `demo-nursery.mashtelot.net/robots.txt` | ✅ Allow + Disallow admin/api/cart/checkout + Sitemap |
| `demo-nursery.mashtelot.net/sitemap.xml` | ✅ 80 כתובות (62 מוצרים, 14 קטגוריות) |
| `mashtelot.net/demo-nursery/catalog` (תוכן כפול) | ✅ 404 |
| חנות (בית, קטלוג, checkout) · דף נחיתה · `/admin/login` · `mashtelot.net/robots.txt` | ✅ 200 |

## 2026-10-18 — C-P1-03 שלב 0 (ענף `fix/c-p1-03-step0-image-optimizer`)

| בדיקה | סביבה | תוצאה |
|---|---|---|
| `/_next/image` עם תמונה מדומיין חיצוני — **לפני** | Production חי | ❌ 200 image/jpeg (האופטימייזר מעבד תמונות מכל דומיין) |
| `/_next/image` עם תמונה מדומיין חיצוני — **אחרי** | local (build) | ✅ 400 |
| next/image בקוד | — | ✅ 0 שימושים (תמונות ב-`<img>`) |
| חנות / admin אחרי השינוי | local | ✅ 200 / 200 |
| `/_next/image` עם תמונה חיצונית — אחרי פריסת `32345a8` | Production חי | ✅ 400 · חנות 200 · תמונות מוצר ב-`<img>` ממשיכות להיטען |

## 2026-10-18 — C-P1-03 שלבים 1–2 (ענף `feat/c-p1-03-next16`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | שלב 1 (Next 15.5.28): יחידה · DB · tsc · build | local | ✅ 81 · 54+4 · ✅ · ✅ |
| 2 | שלב 2 (Next 16.4.2): ESLint 9 · tsc · build (Turbopack) | local | ✅ · ✅ · ✅ (Proxy מזוהה) |
| 3 | יחידה · DB local · DB dev Supabase | — | ✅ 81/81 · 54+4 · 58/58 |
| 4 | **E2E מלא נגד האפליקציה הבנויה — 34/34:** 8 דפי חנות (כולל searchParams/params אסינכרוניים, מסנן וקטגוריה), דף מוצר; robots/sitemap; תוכן כפול 404; משתלה מושעית 404; אופטימייזר 400; **התחברות אמיתית דרך הטופס** (בעלים ✓, סיסמה שגויה ✗, מושעית ✗, סופר-אדמין ✓); הרשאות לפי תפקיד עם ה-session האמיתי; **checkout אמיתי** + ניסיון חוזר + oversell; מסך הזמנות; **התנתקות** מוחקת את העוגייה | local | ✅ |

**הערת בדיקה:** `fetch` של Node מתעלם מכותרת Host — סקריפט ה-E2E עבר ל-`node:http`; האפליקציה עצמה תקינה (אומת ב-curl).
| 5 | `npm audit` אחרי השדרוג | — | ✅ `next` אינו מופיע עוד (כל 23 ה-advisories סגורים); נותרו כלי פיתוח בלבד + `sanitize-html` (תוקן, ראו S-20) |
| 6 | sanitize-html 2.18.1 מול payloads של GHSA-g8qq / GHSA-jxwj + script / javascript: / onerror | — | ✅ כולם נוטרלו; תוכן לגיטימי נשמר |
| 7 | CI על הענף · Vercel Preview (Next 16 על תשתית Vercel — מאשר תאימות גרסת Node) | GitHub · Vercel | ✅ · ✅ |

## 2026-10-18 — קישור בלוג בתפריט החנות (ענף `fix/storefront-blog-link`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | `test/db/storefront-blog-link.test.ts` — מודול כבוי+פוסט מפורסם ✗ · מודול פעיל+טיוטות בלבד ✗ · מודול פעיל+מפורסם ✓ · בידוד בין משתלות | local | ✅ 4/4 |
| 2 | tsc · lint · יחידה · DB מלא | local | ✅ · ✅ · 81/81 · 58+4 |
| 3 | CI על `5ae2a6a` · פריסת Production | GitHub · Vercel | ✅ · ✅ |
| 4 | חי: baitvagan — 2 קישורי `/blog` (מחשב+נייד), `/blog` 200 · demo-nursery — 0 קישורים, `/blog` 404 (מודול כבוי) | Production | ✅ |

## 2026-10-19 — SEC-01 + SEC-02 + S-21 (ענף `feat/sec-01-02-login-log-sessions`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | `test/db/auth-sessions.test.ts` — 10 בדיקות: סיבות כישלון, הודעה גנרית, משתלה מושעית, רשומת audit ללא סיסמה, גרסת session (כולל JWT ישן), החלפת סיסמה מעלה גרסה / כישלון לא מעלה, ביטול לא משפיע על משתמש אחר, S-21 | local | ✅ 10/10 |
| 2 | tsc · lint · יחידה · DB מלא | local | ✅ · ✅ · 81/81 · 68+4 |
| 3 | DB מלא + החלת המיגרציה | dev Supabase (`mashtelot-dev`) | ✅ 72/72 · מיגרציה הוחלה |
| 4 | `prisma migrate diff` (מיגרציות מול schema) | local | ✅ אין סטייה |
| 5 | **E2E נגד האפליקציה הבנויה — 26/26:** התחברות דרך הטופס (כושלת/מוצלחת) נרשמת עם IP/UA וללא סיסמה; JWT ישן ללא `sv` תקף (אין ניתוק בפריסה); "נתק את כל המכשירים" — מכשיר B, ה-cookie הישן וה-JWT הישן נדחים, המכשיר הנוכחי מקבל cookie חדש; החלפת סיסמה — מכשיר אחר מנותק, הנוכחי נשאר; התנתקות נרשמת; 8 ניסיונות → 5 כושלים + חסימה **אחת** ביומן; `/admin/security` לסופר-אדמין בלבד; S-21 — יצירת משתלה עם אימייל הסופר-אדמין נדחית, המשתמש לא שונה ולא נוצרה משתלה | local | ✅ |

**הערת בדיקה:** הריצה הראשונה של ה-E2E נכשלה כי שרת קודם נשאר פעיל עם זיכרון הגבלת-הקצב מהריצה הקודמת (ההגבלה עבדה כמתוכנן); אחרי הפעלה מחדש של השרת — 26/26.
| 6 | CI על `6f5ee36` · פריסת Production | GitHub · Vercel | ✅ · ✅ |
| 7 | חי: `/` 200 · `/admin/login` 200 · `/admin/security` ו-`/admin/account` ללא התחברות → 307 ל-login · חנות + בלוג 200 | Production | ✅ |
| 8 | קריאה בלבד (READ ONLY) ב-Production: העמודה `users.session_version` (integer, default 0) קיימת · המיגרציה `20261019000000` הושלמה · 0 משתמשים עם גרסה ≠ 0 (אף אחד לא נותק) | Production | ✅ |

**לא נבדק חי בכוונה:** ניסיון התחברות ב-Production (היה כותב רשומה לנתוני Production) — רישום היומן יאומת בהתחברות הבאה של הבעלים.

## 2026-10-19 — S-22 + S-23 (ענף `feat/s-22-shared-rate-limit`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | `test/db/rate-limit.test.ts` — 7 בדיקות: עד המגבלה ואז חסימה + retryAfter · שיתוף בין שני "מופעים" (שני חיבורי DB) · **אטומיות: 40 קריאות מקבילות משני מופעים, מגבלה 10 → בדיוק 10** · מפתחות בלתי תלויים · איפוס בסוף חלון · S-23 (מפתח קצר + ניקוי אינם מקצרים מפתח ארוך) · מפתח ארוך מאוד | local · dev Supabase | ✅ 7/7 · ✅ 7/7 |
| 2 | tsc · lint · יחידה · DB מלא | local | ✅ · ✅ · 81/81 · 75+4 |
| 3 | DB מלא + החלת המיגרציה (כולל בדיקת RLS הכללית על הטבלה החדשה) | dev Supabase | ✅ 79/79 |
| 4 | אותה שאילתה דרך ה-pooler במצב transaction (`pgbouncer=true`, כמו Production) | dev Supabase | ✅ ספירה רציפה 1–4, ואחרי 10 מקבילות — 14 |
| 5 | `prisma migrate diff` | local | ✅ אין סטייה |
| 6 | E2E (26 בדיקות SEC-01/02/S-21) על האפליקציה הבנויה | local | ✅ 26/26 |
| 7 | **E2E הפעלה מחדש:** אחרי 8 ניסיונות — השרת נעצר והופעל מחדש (מופע חדש, זיכרון ריק); ניסיון נוסף מ-IP אחר → עדיין חסום | local | ✅ |

**הערת בדיקה:** הריצה הראשונה של בדיקת האטומיות על dev Supabase נכשלה ב-`EMAXCONNSESSION` (ה-pooler במצב session מוגבל ל-15 לקוחות, ושני לקוחות הבדיקה פתחו יותר) — מגבלת סביבת הבדיקה, לא שגיאת לוגיקה. הוגבל `connection_limit=4` ללקוחות הבדיקה → עבר. Production משתמש ב-pooler במצב transaction (פורט 6543) — נבדק בשורה 4.
| 8 | CI על `8a7eb18` · פריסת Production | GitHub · Vercel | ✅ · ✅ |
| 9 | חי: `/` · `/admin/login` · חנות · קטלוג · בלוג → 200 | Production | ✅ |
| 10 | קריאה בלבד ב-Production: `rate_limits` קיימת, RLS פעיל, 0 הרשאות ל-anon/authenticated, המיגרציה הושלמה | Production | ✅ |
| 11 | אזור ה-Functions: `x-vercel-id: fra1::fra1::…` בתגובה דינמית (קטלוג) | Production | ✅ Frankfurt |

## 2026-10-19 — משימה 1: ניווט תחתון (ענף `feat/r01-04-bottom-nav`)

| # | בדיקה | סביבה | תוצאה |
|---|---|---|---|
| 1 | `lib/nav-active.test.ts` (בית מדויק, תתי-נתיבים, ללא התאמת קידומת חלקית) | local | ✅ 3/3 |
| 2 | tsc · lint · יחידה · build | local | ✅ · ✅ · 84/84 · ✅ |
| 3 | צילום מסך headless (Edge) של האפליקציה הבנויה: מובייל — 5 פריטים, "קטלוג" פעיל, אין עגלה כפולה למעלה; מחשב (1280) — אין סרגל תחתון | local | ✅ |

**הערת בדיקה:** ב-390px ה-headless חותך את צד ימין — אותו חיתוך מופיע גם באתר החי (ללא השינוי), כלומר מגבלת רוחב מינימלי של הדפדפן ולא באג; הצילום בוצע ב-500px. **לא נבדק:** פתיחת מגירת החיפוש בלחיצה (אין אוטומציית דפדפן) — מומלץ לבדוק ידנית בטלפון אחרי הפריסה.
