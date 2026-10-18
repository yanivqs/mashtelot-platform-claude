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
