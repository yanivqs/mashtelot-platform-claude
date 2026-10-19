# יומן התקדמות

## 2026-10-16 — סבב 1: Audit ותכנון
- נקראו במלואם `Nursery_Master_Spec_V2_HE.docx` (§1–38 + נספח א׳, PT-01..11, R01–R10) ו-`Nursery_Claude_Code_Development_Plan_HE.docx`. אין pandoc במכונה — הטקסט חולץ ישירות מ-`word/document.xml`.
- אומתו מחדש בקוד (`c337f19`) כל ממצאי P0 מהדוח הקודם; נוספו P0-8 (משתלה מושעית) ו-P0-9 (Idempotency). ראו `SECURITY_FINDINGS.md`.
- טבלת פערים: `MASTER_SPEC_GAP_ANALYSIS.md`.

## 2026-10-16 — תשתית סביבות
- הותקן PostgreSQL 17.11 מקומי (שירות `postgresql-x64-17`), בסיס `mashtelot_test`. פרטי חיבור ב-`.env.test` (מוחרג מ-git).
- נוצר פרויקט Supabase `mashtelot-dev` (ref `xsjwnqltgckkyycicqlc`, eu-central-1) — נפרד מה-Production (`wkcumchuuhmaonrjuvsz`). חיבור אומת בשאילתת קריאה בלבד; ריק. משתנים `DEV_DATABASE_URL`/`DEV_DIRECT_URL` ב-`.env.test`. טרם הורצו עליו מיגרציות.

## 2026-10-16 — E01 / C-P0-04: סביבת בדיקות מבודדת — IN_REVIEW
**דרישה:** §22.04 (אין נתוני Production בבדיקות; reset הרסני רק ליעד מאומת), §2.05 (Tenants סינתטיים), §38.
**מה היה קיים:** `test/setup.ts` טען את `.env` (Production) לכל ריצת `vitest`; `test/checkout.smoke.test.ts` כתב ומחק רשומות ב-DB של Production.
**שינוי (ענף `chore/e01-test-isolation`):**
- `lib/test-db-guard.ts` + 10 בדיקות יחידה: מתיר רק Postgres מקומי שבסיסו מסתיים ב-`_test`, או ref של Supabase שברשימת `TEST_DB_ALLOWED_REFS`; תמיד דוחה כתובת/ref של Production (גם אם הוכנס לרשימת ההיתר).
- `vitest.config.ts` — יחידה בלבד, ללא `.env`. `vitest.db.config.ts` — בדיקות DB עם `globalSetup` (guard → `prisma migrate reset` ליעד) ו-`worker-setup` (Prisma ליעד בלבד).
- `test/db/fixtures.ts` — משתלות A/B פעילות, C מושעית, עם בעלים/מוצר/עמוד/בלוג/קופון/הזמנה.
- smoke test הועבר ל-`test/db/`. `test/setup.ts` הוסר.
- `package.json`: `test`/`test:unit` (יחידה), `test:db`. `.env.example` מתעד את המשתנים.
**תוצאות:** ראו `TEST_RESULTS.md`. ממתין לאישור בעלים למיזוג.
**לא נבדק:** הרצת `test:db` מול `mashtelot-dev` (במכוון — `migrate reset` על Supabase מוחק גם grants של סכמת public; נשמר ל-C-P0-02 עם `migrate deploy`).

## 2026-10-16 — C-P0-01: IDOR בעמודים סטטיים — IN_REVIEW
**דרישה:** §4.07 (הרשאות בשרת), §19.01, §38 (אפס פגיעויות חוצות-משתלות). ממצא P0-1.
**מה היה קיים:** `savePage` עדכן `staticPage.update({ where: { id } })` עם id מהטופס, ללא בדיקת שייכות. קריאה (`pages/[id]`), רשימה, מחיקה וחנות — כבר מסוננים לפי `nurseryId` (נבדק).
**שינוי (ענף `fix/c-p0-01-static-pages-idor`, מבוסס על E01):**
1. `c47d4ab` — הוצאת הלוגיקה ל-`lib/static-pages-admin.ts` **ללא שינוי התנהגות** + 7 בדיקות A/B. הבדיקות נכשלו (2/7) — שחזור הבאג: A דרס את עמוד B.
2. תיקון — `updateMany({ where: { id, nurseryId } })`; 0 שורות → "העמוד לא נמצא". ה-Server Action נשאר דק (זיהוי משתמש, מודול, סניטציה, redirect).
**מחוץ לתחום (מכוון):** fallback ל"משתלה הראשונה" ב-`resolveNurseryId` — C-P1-01.
**סיכון רגרסיה:** נמוך — עמוד שלא שייך למשתלה כבר לא נטען בעורך, כך שמסלול המשתמש הלגיטימי לא משתנה.

## 2026-10-16 — C-P0-02: RLS והרשאות תפקידים ציבוריים — IN_REVIEW
**דרישה:** §1.03, §4.07, §19.01 (Least Privilege), R10-03, §38 ("כל טבלה רלוונטית מוגנת ונבדקה גם בגישת API ישירה"). ממצא P0-2.
**אימות מצב:** ב-`mashtelot-dev` (Supabase, אותה תצורה כמו Production): `postgres` = `bypassrls=true`; default privileges של סכמת public מעניקים ל-anon/authenticated `arwdDxtm` על כל טבלה חדשה.
**שחזור (`026f56e`):** 12 טבלאות ללא RLS (11 מהדוח + `_prisma_migrations`). כ-anon: קריאת `_prisma_migrations` ו-`blog_posts`, INSERT ל-`audit_events`, DELETE מ-`blog_posts` ומ-`_prisma_migrations` — הכול בטרנזקציות שבוטלו; אומת שאין שינוי ב-dev.
**שינוי:** מיגרציה `20261016000000_rls_all_tables_revoke_public_roles`: (1) ENABLE RLS ל-12 הטבלאות; (2) כשהתפקידים קיימים — REVOKE מ-anon/authenticated על טבלאות ו-sequences קיימים, ו-ALTER DEFAULT PRIVILEGES כך שטבלאות עתידיות לא יקבלו הרשאות. Rollback מתועד בראש המיגרציה. `global-setup`: יעד Supabase → `migrate deploy` (לא reset).
**בדיקות:** `test/db/rls.test.ts` — אינווריאנט "אין טבלה ב-public בלי RLS" (חוסם מיגרציות עתידיות), ו-probes קריאה/כתיבה כ-anon ו-authenticated.
**השפעה על Production:** המיגרציה תרוץ אוטומטית ב-Vercel build ברגע שהענף ימוזג ל-main. האפליקציה אינה משתמשת ב-anon/authenticated (חיבור Prisma כ-postgres; העלאות עם service_role לסכמת storage) — לא צפויה השפעה. **דורש אישור נפרד.**

## 2026-10-17 — פריסה: E01 + C-P0-01 → DONE
- בעלים אישר. `main` קודם ל-`55d0415` (fast-forward) ונדחף. Vercel: "Deployment has completed" על הקומיט (GitHub commit status).
- ללא מיגרציה. C-P0-02 (`fix/c-p0-02-rls`, rebase על main) ממתין לאישור נפרד — כולל מיגרציה על Production.

## 2026-10-17 — פריסה: C-P0-02 → DONE
- בעלים אישר החלה בפרודקשן. `main` → `81dacf0`, נדחף. Vercel: success תוך ~75 שנ׳ (`vercel-build` מריץ `migrate deploy` לפני `next build`).
- אומת ב-Production (שאילתות READ ONLY, אגרגטים בלבד): המיגרציה רשומה ו-finished; 0 טבלאות ב-public ללא RLS; 0 הרשאות anon/authenticated.
- הערה: ב-Production 18 רשומות `_prisma_migrations` מול 17 תיקיות — ככל הנראה רשומת rolled-back מספטמבר (ניסיון כושל במיגרציית profile theme). לא קשור לשינוי.

## 2026-10-17 — C-P0-03: סיסמאות Seed — רוטציה בוצעה; קוד IN_REVIEW
**ממצא מאומת:** הבעלים התחבר ל-Production עם `admin1234`. הריפו ב-GitHub **ציבורי** ו-`seed-admin.js` ניתן להורדה (HTTP 200). בנוסף: הרצה חוזרת של `seed-admin.js` (למשל `db:seed:all`) הייתה מחזירה את הסיסמה ל-`admin1234` ומדפיסה אותה.
**הכלה (בוצעה, באישור בעלים):**
1. רוטציית `password_hash` לשני החשבונות (סופר-אדמין + בעלי demo) בטרנזקציה אחת; אומת: סיסמה חדשה עובדת, ישנה לא. סיסמאות חדשות נשמרו רק ב-`.env.credentials.local` (מוחרג מ-git), לא הודפסו.
2. הבעלים החליף `AUTH_SECRET` ב-Vercel וביצע Redeploy — כל ה-sessions נותקו; התחבר מחדש בהצלחה. האתר אומת (200).
**שינוי קוד (ענף `fix/c-p0-03-seed-secrets`):**
- `seed-admin.js`: סיסמאות רק ממשתני סביבה (≥12 תווים), לא דורס סיסמה קיימת בלי `--reset-password`, לא מדפיס סיסמאות.
- `scripts/seed-guard.js`: `seed-admin.js` ו-`seed.js` רצים רק מול יעד מקומי או `SEED_ALLOWED_REFS`.
- מסך "החשבון שלי" (`/admin/account`): החלפת סיסמה עם אימות סיסמה נוכחית, חוזק, rate limit, Audit (`auth.password_changed`), עדכון מותנה. לוגיקה ב-`lib/account.ts`.
- תיקון טיפוסים ב-`test/db/rls.test.ts` (שגיאת `tsc` שנכנסה ב-C-P0-02 — שם לא הורץ typecheck; מעכשיו רץ בכל משימה).
**נותר:** הסיסמה הישנה נשארת בהיסטוריית git (חסרת ערך אחרי הרוטציה). מומלץ לבעלים להחליף שוב סיסמה דרך המסך החדש (הסיסמה הנוכחית נחשפה בהקשר השיחה דרך בחירה ב-IDE). ממצאים חדשים: S-15, S-16.

## 2026-10-17 — C-P0-05: מסלול מיגרציות מבוקר — IN_REVIEW
**ממצא מאומת:** ב-Vercel, `DATABASE_URL`/`DIRECT_URL` מסומנים ל-Production **וגם ל-Preview** (דווח ע"י הבעלים). `vercel-build` מריץ `migrate deploy` בכל build ⇒ כל push של ענף (Preview) היה מריץ מיגרציות על בסיס ה-Production. עד כה לא קרה — נדחף רק `main`.
**שינוי (ענף `fix/c-p0-05-migration-path`):** `scripts/build.js` מחליף את `vercel-build` ואת `build`:
- `VERCEL_ENV=production`: generate → migrate deploy → next build, רק אם שני ה-URLs מצביעים לפרויקט ה-Production (בדיקת שפיות).
- `VERCEL_ENV=preview`: **נכשל** אם אחד ה-URLs מצביע ל-Production; אחרת migrate deploy לבסיס הפיתוח.
- build מקומי: ללא מיגרציות; נחסם מול Production אלא אם `ALLOW_PRODUCTION_DB_BUILD=1` (סוגר S-14).
**תלוי בבעלים:** הפרדת משתני Preview ב-Vercel (ראו הנחיות בתשובה/בהמשך). עד אז builds של Preview ייכשלו בכוונה — מצב בטוח.
**סודות נוספים ב-Preview (§1 קבלה: "Preview אינה משתמשת בסודות Production"):** `AUTH_SECRET`, `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (העלאות מ-Preview היו נכתבות ל-bucket של Production), `RESEND_API_KEY`/`EMAIL_FROM` (Preview היה שולח מיילים אמיתיים) — הומלצה הפרדה.

## 2026-10-18 — C-P0-05 → DONE
- הבעלים הפריד את משתני Preview ב-Vercel (DATABASE_URL/DIRECT_URL → mashtelot-dev; AUTH_SECRET נפרד; Supabase/Resend ללא ערכי Preview). שני ניסיונות נכשלו על ערך שהודבק שגוי (הגנת הסקריפט עצרה לפני חיבור); השלישי הצליח.
- **כל משימות P0 בתוכנית (C-P0-01..05) הושלמו ונפרסו.** פתוח: S-17 (reset סיסמת dev — בעלים).

## 2026-10-18 — C-P1-01: שכבת הרשאות מרוכזת — IN_REVIEW
**החלטות בעלים:** Q1=(a) סופר-אדמין מנהל פלטפורמה בלבד, ללא גישה לנתונים תפעוליים של חנות (מוצרים, הזמנות, לקוחות, הגדרות) — אפיון §4.06, §15.02, §15.05. Q2=(a) משתלה מושעית — חסימה מלאה.
**שינוי (ענף `fix/c-p1-01-nursery-scope`):**
- `lib/nursery-access.ts` (טהור): `decideNurseryAccess`, `isSessionAllowed`, `canUseAdminPortal`.
- `lib/nursery-scope.ts` (שרת): `requireNurseryPage` (הפניה ל-`/admin?notice=<סיבה>`), `requireNurseryAction` / `nurseryActionScope` (שגיאה).
- `lib/ownership.ts`: `assertOwnedBy(db, model, id, nurseryId)` ל-8 סוגי רשומות.
- `lib/auth.ts`: session של בעלים של משתלה מושעית מבוטל מיד. `login`: נחסם עם הודעה.
- 13 דפים + layout עברו ל-`requireNurseryPage`; 15 קובצי actions ל-`requireNurseryAction` עם המודול הנכון (כולל צמח/ציוד בנפרד ב-browse). **0 מופעים** של "המשתלה הראשונה". הוסרה עקיפת סופר-אדמין ב-ownedProduct/ownedCategory/orders. דף ההזמנות לבעלים בלבד.
- `updateNursery` (בעלים): שדות עיצוב נשמרים מהשרת כשמודול העיצוב/הקרוסלה כבוי (`lib/design-lock.ts`, טהור).
- לוח הבקרה מציג את סיבת ההפניה.
**תקלה בדרך (תוקנה):** `pages/actions.ts` היה בקידוד CRLF אחרי checkout, וסקריפט ה-patch שכפל תוכן; שוחזר מ-HEAD ותוקן. מעכשיו כל patch מנרמל שורות לפני חיפוש.
**השפעה על משתמשים:** סופר-אדמין שנכנס למסכי חנות יופנה ללוח הבקרה עם הסבר (היום הוא עורך בשקט את המשתלה הוותיקה). בעלי משתלות פעילות — ללא שינוי, למעט מודול כבוי שכעת נחסם גם בפעולה.

## 2026-10-18 — C-P1-04: CI — IN_REVIEW
**דרישה:** §22.01 (Build, Typecheck, Lint, Unit, בדיקות אבטחה/בידוד בכל PR), §22.04 (ללא Production), §22.06 (הרשאות CI מינימליות).
**ממצא:** lint מעולם לא רץ — `eslint.config.mjs` הוא flat config ל-ESLint 9 / Next חדש, והמותקן הוא ESLint 8 + Next 14, ולכן `next lint` נעצר בבקשת הגדרה ו-`next build` דילג על lint.
**שינוי (ענף `chore/c-p1-04-ci`):**
- `.github/workflows/ci.yml`: job מהיר (typecheck, lint, unit) ו-job DB (Postgres 17 זמני בתוך ה-job → `test:db` → `npm run build`). ללא secrets, `contents: read`. רץ על כל push לכל ענף.
- `.eslintrc.json` (next/core-web-vitals) במקום `eslint.config.mjs`. `react/no-unescaped-entities` כבוי — גרשיים לגיטימיים בעברית (13 מתוך 16 הממצאים). תוקנו: תלות useMemo לא יציבה ב-checkout, הפניה לכלל לא טעון ב-2 בדיקות.
- `next build` מריץ כעת lint.
**אימות:** CI ירוק על הענף (54 שנ׳ + 93 שנ׳). **בדיקה שלילית:** ענף זמני עם באג חוצה-משתלות מכוון ב-`lib/ownership.ts` → job ה-DB נכשל (בדיקות הבידוד תפסו), ה-job המהיר עבר; הענף נמחק.
**פתוח (החלטת בעלים):** חסימת מיזוג בפועל — Branch protection ב-GitHub דורש עבודה דרך PR; כרגע הדחיפה ל-main ישירה.

## 2026-10-18 — החלטת בעלים: מדיניות מיזוג
- דחיפה ישירה ל-`main` (ללא Branch protection / PR).
- כלל מחייב: ענף ממוזג ל-`main` **רק אחרי ש-CI ירוק על הקומיט האחרון שלו**; התוצאה מוצגת לבעלים לפני בקשת אישור לפריסה.

## 2026-10-18 — C-P1-02: הזמנות ומלאי — IN_REVIEW
**החלטות בעלים:** (1) שמירת מלאי זמנית עם פקיעה; (2) 48 שעות, בפקיעה — שחרור מלאי **בלי** ביטול ההזמנה; (3) סטטוסי R05-07 + סטטוס תשלום נפרד; (4) מגבלת קופון ללקוח ומינימום הזמנה — במשימה זו.
**מצב לפני:** מלאי ירד ביצירת הזמנה ולא חזר בביטול; כל מעבר סטטוס מותר; אין הגנה מהזמנה כפולה; קופון/הנחה לא נשמרו על ההזמנה. בפרודקשן: הזמנה אחת (PENDING), 2 משתלות, 70 מוצרים.
**מיגרציות:** `20261018000000_orders_inventory_expand` (ערכי סטטוס חדשים, `PaymentStatus`, `StockState`, `StockMovementReason`, טבלת `stock_movements` + RLS, עמודות Snapshot/Idempotency/פקיעה ב-orders, `reserved_quantity`, מגבלות קופון) ו-`20261018000100_orders_inventory_migrate` (ברירת מחדל RECEIVED; המרת הזמנות קיימות — מלאי COMMITTED כי במודל הקודם כבר ירד). שתיים בגלל מגבלת PostgreSQL על שימוש בערך enum חדש באותה טרנזקציה. ערכי הסטטוס הישנים נשמרים (Contract בעתיד). נבדק: אין drift מול הסכמה; המרת כל סטטוס ישן נבדקה על בסיס זמני.
**קוד:** `lib/order-state.ts` (מכונות מצבים + השפעות מלאי, טהור), `lib/order-service.ts` (יצירה, מעברים, תשלום, פקיעה, עדכון מלאי ידני — DB כפרמטר; כל שינוי מלאי עדכון מותנה אטומי + StockMovement), `lib/stock.ts`. checkout משתמש בשירות + מפתח idempotency מהלקוח; שגיאה טכנית לא נחשפת ללקוח. מסך הזמנות: מעברים חוקיים בלבד, סטטוס תשלום, מצב מלאי, שחרור שמירות שפגו בטעינה. עריכת מלאי ידנית לא מתחת לשמור. חנות ו-JSON-LD לפי זמין. טופס קופון: מגבלה ללקוח + מינימום.

## 2026-10-18 — C-P1-05: SEO — sitemap, robots, תוכן כפול — IN_REVIEW
**מצב חי לפני:** `/robots.txt` ו-`/sitemap.xml` → 404; `mashtelot.net/demo-nursery/catalog` → 200 (החנות מוגשת גם בדומיין הראשי — תוכן כפול).
**שינוי (ענף `feat/c-p1-05-seo-sitemap-robots`, ללא מיגרציה):**
- `lib/tenant-host.ts` — זיהוי משתלה לפי Host (טהור), משותף ל-middleware ולמסלולים.
- `lib/seo-files.ts` — `buildRobots` / `buildSitemap` (טהור: קידוד עברית, escape ל-XML, ללא כפילויות).
- `lib/sitemap-data.ts` — רשומות לפי כללי החנות: בית, קטלוג, צור קשר, קטגוריות עם מוצרים, מוצרים פעילים, עמודים מפורסמים (מודול static_pages), בלוג (מודול blog). כתובות לפי ה-origin הקנוני (דומיין מותאם גובר).
- `app/robots.txt/route.ts`, `app/sitemap.xml/route.ts` — לפי הדומיין; Preview / משתלה מושעית / דומיין לא מוכר → `Disallow: /` (robots) / 404 (sitemap).
- `middleware.ts` — דומיין ראשי: רק `/`; כל נתיב אחר → 404.
**לא בתחום (בקלוג):** הפניות 301 (§14.01, R07-07) — דורש ניהול הפניות במודל נתונים.

## 2026-10-18 — C-P1-03: שדרוג Next.js — Audit, החלטות ושלב 0
**Audit:** 23 advisories על `next@14.2.35` (2 קריטיים). כל ה-advisories מתוקנים ב-15.5.24+ וב-16.3.3+. שאר 20 הממצאים — כלי פיתוח/build בלבד (vitest, vite, tailwind, eslint). היקף: useFormState ב-22 קבצים, params ב-20 קבצים, cookies×3, headers×1, clientIp×4, middleware→proxy, next lint→ESLint 9 flat, Turbopack. ללא next/image, revalidateTag, unstable_cache, AMP, runtimeConfig, webpack מותאם.
**החלטות בעלים:** יעד 16.4.2; פריסה אחת בסוף; שלב 0 עכשיו בנפרד.
**שלב 0:** הוסר `images.remotePatterns: [{ hostname: '**' }]` (next/image אינו בשימוש). לפני: `/_next/image` עם תמונה חיצונית → 200 (חי). אחרי: 400 (local). ממתין: גרסת Node ב-Vercel (≥20.9) לפני שלב 2.

## 2026-10-18 — C-P1-03 שלבים 1–2: Next.js 16.4.2 + React 19 — DONE (נפרס `7ea00a1`, smoke חי עבר)
**שלב 1 (`f6ae051`):** next 15.5.28 + react 19.3.1. codemod רשמי `next-async-request-api` (22 קבצים, 0 שגיאות); 2 מקרים שה-codemod לא סיים (`destroySession`, `clientIp`) — הושלמו ידנית והקוראים ממתינים. `useFormState` → `useActionState` ב-22 קבצים. React 19 types: `JSX` → `React.JSX`.
**שלב 2:** next 16.4.2, eslint 9.39.5, eslint-config-next 16.4.2. `middleware.ts` → `proxy.ts` (Node runtime; הקוד אינו תלוי ב-Edge). `next lint` הוסר → `eslint.config.mjs` (flat) + `npm run lint` ב-CI. Turbopack ב-build (ללא webpack מותאם). `tsconfig` — `jsx: react-jsx` (שינוי אוטומטי של Next 16). כלל חדש `react-hooks/set-state-in-effect` — יחיד ב-cart-provider (טעינת localStorage אחרי hydration, מכוון) — הותר מקומית עם הסבר. `serverActions.bodySizeLimit` נשאר ב-`experimental` (אומת בטיפוסים).
**התקנה:** הניסיון הראשון ל-next 16 נכשל ב-ERESOLVE (eslint 8 מול eslint-config-next 16 שדורש ≥9) — הותקן eslint 9 תחילה והניסיון החוזר הצליח; `npm ls` נקי.
**הערה:** `AGENTS.md` מפנה ל-`node_modules/next/dist/docs` — קיים כעת עם Next 16.

## 2026-10-18 — תיקון: קישור "בלוג" בתפריט החנות — DONE (נפרס `5ae2a6a`, אומת חי)
**דיווח בעלים:** "אין תצוגה של הבלוג בצד המשתמש של המשתלה".
**ממצאים מאומתים (קריאה בלבד מ-Production + בדיקה חיה):** `baitvagan` — מודול בלוג פעיל, 2/2 פוסטים מפורסמים, `/blog` ו-`/blog/tavlins` → 200, הבלוג ב-sitemap — אך **0 קישורים ל-`/blog` בתפריט**. `demo-nursery` — מודול הבלוג כבוי ו-0 פוסטים → `/blog` 404 (התנהגות מכוונת).
**שורש:** `SiteHeader` לא כלל קישור לבלוג כלל.
**תיקון:** `hasPublicBlog(nurseryId)` ב-`lib/pages.ts` (מודול פעיל + לפחות פוסט מפורסם אחד) → `showBlog` מ-`app/[tenant]/layout.tsx` → פריט "בלוג" בתפריט (מחשב ונייד), אחרי "קטלוג". אין שינוי סכמה/נתונים.

## 2026-10-18 — SEC-01 + SEC-02: Audit ותוכנית — ממתין לאישור
**Audit (VERIFIED בקוד):** אין שום רישום של ניסיונות התחברות/התנתקות; `auth.password_changed` נרשם ב-`audit_events`. ה-JWT (7 ימים) מכיל רק `sub` — החלפת סיסמה אינה מבטלת sessions אחרים. איפוס סיסמת בעלים ע"י סופר-אדמין (`nurseries/actions.ts`) — אינו מבטל sessions ואינו נרשם. ממצאים חדשים: S-21, S-22.
**מגבלה:** אין נתוני עבר — SEC-01 לא יכול לענות בדיעבד אם הסיסמה החשופה נוצלה לפני הרוטציה (לוגים של Vercel נשמרים לזמן קצר בלבד).
**החלטות בעלים (2026-10-19):** Q1-א יומן לסופר-אדמין בלבד · Q2-א IP מלא · Q3-א תיקון S-21 במסגרת המשימה · **מיגרציה אושרה** (הוספת `users.session_version` תרוץ ב-Production עם הפריסה).

## 2026-10-19 — SEC-01 + SEC-02 + S-21: מימוש — DONE (נפרס `6f5ee36`, המיגרציה הוחלה ב-Production ואומתה)
**SEC-01:** `lib/login.ts` — `authenticateAdmin` (סיבת כישלון: unknown_email / bad_password / portal_denied; אותה הודעה גנרית ללקוח) ו-`loginAuditEvent`. נרשמים ל-`audit_events`: `auth.login_success`, `auth.login_failed`, `auth.login_blocked` (פעם אחת לחלון הגבלה — מניעת ניפוח), `auth.logout`, `auth.sessions_revoked`. metadata: IP מלא, User-Agent (200 תווים), סיבה. הסיסמה לעולם אינה נרשמת. מסך `/admin/security` (סופר-אדמין בלבד): סינון לפי אירוע ואימייל, עימוד, שעון ישראל.
**SEC-02:** מיגרציה `20261019000000_user_session_version` (תוספת בלבד, ברירת מחדל 0; שחזור: הקוד הקודם מתעלם מהעמודה). JWT כולל `sv`; `getSessionUser` דוחה גרסה ישנה; JWT ללא `sv` = גרסה 0 (אין ניתוק בפריסה). החלפת סיסמה מעלה את הגרסה באותו עדכון אטומי ומנפיקה session חדש למכשיר הנוכחי. כפתור "נתק את כל המכשירים האחרים" ב-`/admin/account`.
**S-21:** `createNursery` — אימייל של משתמש קיים נדחה לפני יצירת המשתלה; `upsert` הוחלף ב-`create` (מרוץ → שגיאה, לא דריסה).
**הערה:** אין זרימת "איפוס סיסמת בעלים" ע"י סופר-אדמין מלבד יצירת משתלה (שכעת לא נוגעת במשתמש קיים) — לכן לא נדרש שם ביטול sessions.

## 2026-10-19 — S-22: הגבלת קצב משותפת — Audit ותוכנית — ממתין לאישור
**Audit (VERIFIED בקוד):** `lib/rate-limit.ts` — חלון נע ב-`Map` בזיכרון המופע. 7 נקודות שימוש: התחברות (IP 10/10 דק', אימייל 5/15 דק', סימון חסימה ביומן), החלפת סיסמה, ניתוק מכשירים, מייל בדיקה, checkout (6/10 דק' ל-IP), העלאת קבצים (40/10 דק' ל-IP). ב-Vercel כל מופע (וכל cold start) מתחיל מאפס — תוקף שמפזר בקשות בין מופעים מקבל מכסה כפולה ויותר.
**ממצא נוסף (S-23, VERIFIED):** `sweep()` מנקה את **כל** המפתחות לפי חלון הקריאה הנוכחית — קריאה עם חלון 10 דק' מוחקת פגיעות בנות 10–15 דק' של מפתח האימייל (חלון 15 דק'), כך שחלון האימייל מתקצר בפועל ל-10 דק'.
**ADR / החלטות בעלים (2026-10-19):** Q1-א טבלה ב-Postgres הקיים (ללא ספק חדש) · Q2-א כשל בבדיקה → הבקשה מותרת + שגיאה בלוג · Q3-א חלון קבוע · **מיגרציה אושרה** (`rate_limits`).

## 2026-10-19 — S-22 + S-23: מימוש — DONE (נפרס `8a7eb18`, הטבלה אומתה ב-Production)
**מיגרציה** `20261019010000_rate_limits`: טבלה חדשה (key PK, window_start, count, expires_at + אינדקס), RLS ללא policies, REVOKE מ-anon/authenticated. שחזור: הקוד הקודם אינו משתמש בטבלה; `DROP TABLE` להסרה מלאה.
**קוד:** `lib/rate-limit-store.ts` — `hitRateLimit` בשאילתה אטומית אחת (שעון ה-DB), `purgeExpiredRateLimits`. `lib/rate-limit.ts` — `rateLimit` אסינכרוני, ניקוי הסתברותי (1%), fail-open עם `console.error`. ה-Map בזיכרון הוסר (פותר גם את S-23). 7 נקודות הקריאה עודכנו ל-`await` בלבד — המגבלות עצמן לא שונו.
**הבדל התנהגות:** בחלון קבוע גם ניסיונות חסומים נספרים (אינם מאריכים את החלון); בגבול בין שני חלונות אפשרי פרץ של עד פי 2 (מקובל — Q3-א).

## 2026-10-19 — פיצ'רי חנות MVP (6 משימות) — Audit ותוכנית — ממתין לאישור
**מקור:** §6, §7.01, §8.01, §9.01, §10.03, §14.01, R01-04, R02-02, R02-03, R04-03, R05-06, R07-07.
**ממצאי Audit (VERIFIED בקוד):**
- **וריאנטים:** `NurseryProduct` שטוח — מחיר/מלאי/שמור ברמת מוצר; `OrderItem` ו-`StockMovement` מצביעים על מוצר. השפעה: 13 קבצים (order-service, stock, checkout-calc, עגלה, דף מוצר, כרטיס, ניהול מוצרים, JSON-LD).
- **חיפוש:** בזיכרון על אינדקס הקטלוג (`lib/catalog-filter.ts`) — `includes` על טקסט מנורמל (אותיות קטנות + רווחים). אין נרמול סופיות/ניקוד/תחיליות, אין סובלנות לשגיאות, אין נרדפות, אין דירוג רלוונטיות.
- **ניווט מובייל:** תפריט המבורגר עליון בלבד (`mobile-menu.tsx`); אין סרגל תחתון.
- **תשלום ידני:** enum `PaymentMethod` = BIT / PAYBOX / BANK_TRANSFER. אין PayPal ואין תשלום באיסוף/למשלוח.
- **301:** אין טבלת הפניות; `proxy.ts` אינו ניגש ל-DB (רק תת-דומיין); `[tenant]/not-found.tsx` מציג 404.
- **סנכרון (CONFLICT מול §6):** `resolveProductContent` קורא את שם/תיאור/תמונת הצמח **חי** מהקטלוג המרכזי כשאין Override, ומאפייני המסננים (אור/מים/גובה…) נקראים חי מ-`plants`. כלומר כל עריכה של סופר-אדמין או יבוא CSV (`plant-import.ts` — upsert) **משנה מיד** מוצרים של כל המשתלות — בניגוד לקריטריון "שינוי מרכזי לא משנה מוצר מקומי ללא אישור".
**החלטות בעלים (2026-10-19):** Q1-א וריאנט עם מחיר ומלאי משלו; **מחיר הווריאנט אופציונלי** (ריק = יורש ממחיר המוצר) + **שיוך תמונה/ות לווריאנט**; תוספות ללא מלאי נדחות · Q2-א מילון נרדפות גלובלי בניהול סופר-אדמין · Q3-א "תשלום באיסוף" + "תשלום לשליח" נפרדים · Q4-א עותק מקומי של כל השדות כולל מאפיינים בוטניים · Q5-א הפניה 308 (permanentRedirect) · מיגרציות אושרו; סדר 1→6, כל משימה עם אישור פריסה.

## 2026-10-19 — משימה 1: ניווט תחתון במובייל (R01-04) — IN_REVIEW (ענף `feat/r01-04-bottom-nav`)
`components/storefront/bottom-nav.tsx`: סרגל קבוע (md:hidden) — בית · קטלוג · חיפוש (מגירה תחתונה, GET ל-`/catalog?q=`) · צור קשר · עגלה/הצעה עם מונה (מוסתר כשהמכירה כבויה). מצב פעיל לפי הנתיב (`lib/nav-active.ts`), `aria-current`, safe-area ל-iPhone, ריווח בתחתית הדף. העגלה הוסרה מהכותרת העליונה במובייל (עברה לסרגל); תפריט ההמבורגר העליון נשאר (R01-04: "ניווט תחתון, חיפוש ותפריט עליון"). ללא שינוי DB.

## 2026-10-19 — משימה 2: PayPal + תשלום באיסוף / לשליח (R05-06, §10.03) — IN_REVIEW (ענף `feat/r05-06-manual-payments`)
**מיגרציה** `20261019020000_payment_methods_paypal_on_site`: 3 ערכי enum חדשים (PAYPAL, PAY_ON_PICKUP, PAY_ON_DELIVERY) — תוספת בלבד.
**כללים** (`lib/payment-methods.ts`, טהור): "תשלום באיסוף" רק באיסוף, "תשלום לשליח" רק במשלוח — מסונן בטופס ו**נאכף בשרת** (`createOrder` מחשב קודם את אופן הקבלה; ערך לא מוכר או לא תואם → שגיאה). בתשלום במקום אין אסמכתא (נמחקת גם אם נשלחה). PayPal: יעד חייב להיות `https://paypal.me/…` או `https://www.paypal.com/…` (מוצג ללקוח כקישור — חוסם `javascript:` ודומיינים מתחזים); לאמצעי תשלום במקום אין שדה יעד.
**הערה (§10.04):** אמצעים ידניים בלבד — אין חיוב או אימות תשלום אוטומטי; ההזמנה נשארת "לא שולם" עד סימון ידני של בעל המשתלה.

## 2026-10-19 — E2E בדפדפן (Playwright) — IN_REVIEW (ענף `chore/playwright-e2e`)
**בקשת בעלים:** אוטומציית לחיצות בדפדפן. `@playwright/test` 1.56.1 (תלות פיתוח) + Chromium.
**הרצה:** `npm run test:e2e` (`scripts/e2e.js`) — מוודא Postgres **מקומי** ששמו מסתיים ב-`_test` (לעולם לא Supabase/Production), מריץ מיגרציות ו-build, ומפעיל את Playwright מול `next start`. נתונים קבועים ב-`e2e/global-setup.ts` (משתלה `e2eshop` ב-`http://e2eshop.localhost:3100`). פרויקטים: mobile (Pixel 7) ו-desktop.
**CI:** job שלישי `E2E (Playwright, Chromium)` עם Postgres זמני; דוח + trace מועלים כ-artifact בכישלון.
**באג אמיתי שנמצא ותוקן (UX-01a):** אחרי התחברות כושלת שדה האימייל התרוקן — React 19 מאפס טפסים אחרי Server Action (נכנס עם C-P1-03). תוקן בהחזרת האימייל ב-state + `defaultValue`.

## 2026-10-19 — משימה 3: חיפוש חכם בעברית (R04-03) — IN_REVIEW (ענף `feat/r04-03-smart-search`)
**מנוע** `lib/search.ts` (טהור): נרמול (ניקוד, אותיות סופיות, גרשיים, פיסוק), הסרת עד שתי תחיליות ו/ה/ב/ל/מ/ש/כ (שורש ≥3), יחיד/רבים (ים/ות), שגיאות כתיב (Damerau-Levenshtein: 1 ל-4+ אותיות, 2 ל-8+; רק על המילה שהוקלדה), נרדפות (מילה וביטוי שלם), AND בין מילים, **דירוג רלוונטיות** (מדויק > תחילת מילה > מכיל > שגיאה; אחר כך חדשים). התאמת "תחילת מילה" רק על המילה המקורית והנרדפות — צורות מקוצרות רק בהתאמה מדויקת (מונע "שמיר"→"מיר"→"מירטוס").
**שילוב:** `lib/catalog-filter.ts` — מסמך חיפוש לכל מוצר באינדקס (שם, שם עברי מקורי, לטיני, כינוי); ספירות אותיות ופאסטים מחושבות על תוצאות החיפוש. המילון נטען רק כשיש חיפוש (`lib/synonyms.ts`).
**מיגרציה** `20261019030000_search_synonyms`: טבלה `search_synonym_groups` (RLS, ללא הרשאות ציבוריות) + **17 קבוצות התחלתיות — לבדיקת הבעלים לפני פריסה**. מסך ניהול `/admin/search-synonyms` (סופר-אדמין): הוספה, עריכה, מחיקה, ולידציה (2–20 מונחים, עד 60 תווים, לא זהים אחרי נרמול), Audit לכל שינוי, הקלט נשמר בשגיאה (UX-01).
**מחוץ להיקף:** חיפוש בניהול (מסכי מלאי/שיוך) נשאר התאמת תת-מחרוזת.

## 2026-10-19 — משימה 4: הפניות מכתובות ישנות (§14.01, R07-07) — IN_REVIEW (ענף `feat/s14-redirects`)
**מיגרציה** `20261019040000_redirects`: טבלה `redirects` (משתלה, נתיב ישן מנורמל — ייחודי למשתלה, יעד, מונה כניסות, כניסה אחרונה), RLS ללא הרשאות ציבוריות. תוספת בלבד.
**כללים** (`lib/redirects.ts`, טהור): נרמול נתיב (URL מלא של האתר הישן → נתיב; פענוח; לוכסנים; אותיות קטנות; בלי query/#); **יעד פנימי בלבד** (חוסם `//host`, `http…`, `/\`, `javascript:` — מניעת Open Redirect); אין הפניה מדף הבית; **קיצור שרשראות אוטומטי** בשני הכיוונים ודחיית לולאות; CSV (פסיק/נקודה-פסיק/טאב, כותרת אופציונלית, עד 2,000 שורות, שגיאות לפי שורה).
**הפעלה:** `redirectOrNotFound` במקום `notFound()` בדף עמוד, מוצר, פוסט, ונתיב catch-all חדש `[pageSlug]/[...rest]` לנתיבים עמוקים — **רק כשהדף לא קיים** (אין עלות בגלישה רגילה). הפניה קבועה 308 (Q5-א). `proxy.ts`: נתיבים עם סיומות דפים ישנים (html/htm/php/asp/aspx/jsp/cfm) מועברים לחנות במקום להיחשב קבצים סטטיים; קבצים אמיתיים (robots.txt, תמונות) לא מושפעים. שמירה/מחיקה מרעננת את הנתיב ב-ISR.
**ניהול:** `/admin/redirects` לבעל המשתלה (בתפריט: "הפניות (SEO)") — הוספה, יבוא CSV (הדבקה או קובץ עד 1MB), טבלה עם מונה כניסות, מחיקה; Audit לכל שינוי; הקלט נשמר בשגיאה (UX-01).
**מגבלות ידועות:** התאמה לפי נתיב בלבד (query של כתובת ישנה, למשל `?p=123`, אינו נבדק); נתיבים מתחת לנתיבים קבועים (למשל `/catalog/x`) אינם עוברים דרך ההפניות; המונה עשוי להחסיר כניסות כשהדף נשמר ב-ISR.
