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
