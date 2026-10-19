# ממצאי אבטחה

מקור דרישות: `Nursery_Master_Spec_V2_HE.docx` (§1, §2, §4, §19, §22, §38).
מקרא אימות: **VERIFIED** = נבדק בקוד/בבדיקה · **REPORTED** = מדוח קודם, לא אומת מחדש · **UNKNOWN** = לא ניתן לאימות מהריפו (דורש גישה לסביבה).
קוד בסיס: `c337f19` (main). עודכן: 2026-10-16.

| ID | ממצא | חומרה | אימות | ראיה | סטטוס | משימה |
|---|---|---|---|---|---|---|
| P0-1 | IDOR: עדכון עמוד סטטי לפי `id` ללא בדיקת `nurseryId` | גבוהה | VERIFIED | `app/admin/(dash)/pages/actions.ts:79` | **FIXED** — נפרס ב-`55d0415` (2026-10-17) | C-P0-01 |
| P0-2 | 11 טבלאות ללא RLS: `nursery_payment_methods`, `audit_events`, `nursery_channels`, `shipping_zones`, `shipping_zone_cities`, `plant_categories`, `plant_category_assignments`, `import_jobs`, `nursery_categories`, `nursery_product_categories`, `blog_posts` | **קריטית** | VERIFIED — שוחזר ב-`mashtelot-dev`: anon קרא/כתב/מחק דרך default privileges של Supabase. בפרודקשן: UNKNOWN (אותה תצורת ברירת מחדל צפויה) | + `_prisma_migrations` (anon יכול היה למחוק את היסטוריית המיגרציות) | **FIXED** — `81dacf0`, מיגרציה הוחלה ב-Production ואומתה (2026-10-17) | C-P0-02 |
| P0-3 | סיסמאות קשיחות ב-seed (`admin1234`, `owner1234`) — **הריפו ב-GitHub ציבורי**, והסיסמה עבדה בפרודקשן לחשבון הסופר-אדמין | **קריטית** | VERIFIED — הבעלים התחבר בהצלחה; הקובץ ניתן להורדה ציבורית (HTTP 200) | `seed-admin.js:10-12` | **MITIGATED** 2026-10-17: סיסמאות שני החשבונות הוחלפו ב-Production; `AUTH_SECRET` הוחלף + Redeploy (ניתוק כל ה-sessions). **FIXED** — קוד נפרס ב-`15ac17d`; `seed-admin.js` הציבורי ב-GitHub אינו מכיל עוד את הסיסמה | C-P0-03 |
| P0-4 | בדיקות DB ללא הפרדה מ-Production; `test/setup.ts` טען את `.env` לכל ריצת בדיקות | גבוהה | VERIFIED | `test/setup.ts` (הוסר), `vitest.config.ts` | **FIXED** — נפרס ב-`55d0415` (2026-10-17) | E01 |
| P0-5 | `prisma migrate deploy` רץ בכל build, כולל Preview — **ול-Preview מוגדרים DATABASE_URL/DIRECT_URL של Production** (אישור בעלים 2026-10-17) | **קריטית** | VERIFIED | `package.json` `vercel-build`; הגדרות Vercel | **FIXED** — קוד `e45fa46`; Preview מופרד ל-`mashtelot-dev` (אומת ב-build Preview מוצלח) | C-P0-05 |
| P0-6 | אכיפת מודולים רק בדפים, לא ב-Server Actions | בינונית | VERIFIED | רק blog/pages/categories קוראים ל-`requireModule` | **FIXED** — נפרס ב-`58e3d00` | C-P1-01 |
| P0-7 | ברירת מחדל ל"משתלה הראשונה" בפעולות סופר-אדמין | בינונית | VERIFIED (24 מופעים) | `findFirst({ orderBy: { createdAt: 'asc' } })` | **FIXED** — נפרס ב-`58e3d00` — 0 מופעים | C-P1-01 |
| P0-8 | בעלים של משתלה מושעית מתחבר לפורטל | בינונית | VERIFIED | `app/admin/login/actions.ts` אינו בודק `nursery.isActive` | **FIXED** — נפרס ב-`58e3d00` — גם sessions קיימים | C-P1-01 |
| P0-9 | אין Idempotency ביצירת הזמנה (שליחה כפולה = שתי הזמנות) | בינונית | VERIFIED | `app/[tenant]/checkout/actions.ts` | **FIXED** — נפרס ב-`2c76406` | C-P1-02 |
| S-10 | Next.js 14.2.35 — 23 advisories, כולל 2 קריטיים (RCE ב-Image Optimization API עם AVIF; RCE בשרתי Windows — לא רלוונטי ל-Vercel). מתוקן ב-15.5.24+ / 16.3.3+ | **קריטית** | VERIFIED (npm audit + GitHub advisories, 2026-10-18); חשיפת האופטימייזר אומתה חי (תמונה חיצונית → 200) | `package.json`, `next.config.js` | **שלב 0 נפרס** (`32345a8`): הוסר `remotePatterns` → תמונה חיצונית 400 (אומת חי). **FIXED** — שודרג ל-16.4.2, נפרס ב-`7ea00a1` ואומת חי (2026-10-18) | C-P1-03 |
| S-11 | bucket אחסון ציבורי (כולל artwork של דפוס) | בינונית | VERIFIED | `lib/upload-actions.ts` | OPEN | C-PT-03 (PT-08) |
| S-12 | `log: ['query']` ב-Prisma גם בפרודקשן | נמוכה | VERIFIED | `lib/prisma.ts` | OPEN | — |
| S-13 | Vercel Functions ב-`iad1` מול DB ב-`eu-central-1` (ביצועים) | נמוכה (ביצועים) | VERIFIED (`x-vercel-id`, host ה-DB) | header חי + `.env` | **RESOLVED** — אומת חי 2026-10-19: `x-vercel-id: fra1::fra1::…` בתגובה דינמית — ה-Functions רצות כבר ב-Frankfurt (קרוב ל-DB ב-eu-central-1). לא ידוע מתי/איך שונה (הגדרת הפרויקט ב-Vercel; אין `vercel.json` בריפו) | הצעה נפרדת |
| S-14 | `next build` מקומי מבצע prerender שקורא (קריאה בלבד) מבסיס ה-Production דרך `.env` | נמוכה | VERIFIED (build של C-P0-01) | `app/page.tsx` (revalidate 3600) | **FIXED** — `e45fa46`: build מקומי נחסם מול Production | C-P0-05 |

| S-15 | אין יומן התחברויות — לא ניתן לדעת אם הסיסמה החשופה נוצלה לפני הרוטציה | בינונית | VERIFIED (אין רישום ב-`login/actions.ts`) | — | **FIXED** — נפרס ב-`6f5ee36` (2026-10-19) — יומן התחברויות מעכשיו והלאה (אין נתוני עבר) | SEC-01 |
| S-16 | החלפת סיסמה אינה מנתקת sessions קיימים של אותו משתמש (JWT 7 ימים ללא גרסת session) | בינונית | VERIFIED | `lib/auth.ts` | **FIXED** — נפרס ב-`6f5ee36` (2026-10-19) — `session_version` | SEC-02 |

## הנחות שטרם נבדקו
- ה-anon key של פרויקט ה-Production לא דלף (אינו בריפו; לא נבדק מעבר לזה).
- גיבויים/PITR בפרויקט ה-Production — תלוי במסלול Supabase; אין תרגיל שחזור מתועד.

## ממצאים תפעוליים (2026-10-18)
- S-17: סיסמת בסיס הפיתוח (`mashtelot-dev`) נחשפה בהקשר השיחה דרך בחירה ב-IDE. חומרה נמוכה (סביבת פיתוח ריקה). פעולה: Reset ב-Supabase + עדכון `.env.test` ו-Vercel Preview — **ממתין לבעלים**.
- S-18: npm ב-Vercel אינו מריץ install scripts (כולל `postinstall` של Prisma) — `scripts/build.js` מריץ `prisma generate` במפורש, כך שאין השפעה. לתיעוד בלבד.
- S-19 (SEO/תוכן כפול): החנות הוגשה גם בדומיין הראשי (`mashtelot.net/demo-nursery/catalog` → 200, אומת חי). **FIXED** — `f1c5914`, אומת חי (404).
- S-20: `sanitize-html` 2.17.5 — 2 advisories XSS (GHSA-g8qq-57p8-ggw5 SVG SMIL, GHSA-jxwj-j7wr-gfrw textarea). חשיפה בפועל נמוכה (רשימת ההיתר אינה כוללת svg/textarea; תוכן נכתב רק בידי בעלי משתלות). **FIXED** — נפרס ב-`7ea00a1` — שודרג ל-2.18.1; payloads של שני ה-advisories ותבניות XSS נפוצות נבדקו מול התצורה שלנו — כולם נוטרלו, תוכן לגיטימי נשמר.
- S-21 (נמצא ב-Audit של SEC-01/02): יצירת משתלה ב-`app/admin/(dash)/nurseries/actions.ts` מבצעת `user.upsert` לפי אימייל הבעלים — אם האימייל שייך למשתמש קיים (בעלים של משתלה אחרת, או סופר-אדמין) הוא **מועבר למשתלה החדשה, תפקידו הופך ל-NURSERY_OWNER וסיסמתו נדרסת**. VERIFIED (קוד). חומרה בינונית-נמוכה (רק סופר-אדמין מפעיל). **FIXED** — נפרס ב-`6f5ee36` (2026-10-19) (אושר Q3-א).
- S-22: הגבלת הקצב (`lib/rate-limit.ts`) נשמרת בזיכרון של מופע ה-Function — ב-Vercel כל מופע סופר בנפרד, כך שההגבלה חלקית. VERIFIED (קוד). חומרה נמוכה-בינונית. **FIXED** — נפרס ב-`8a7eb18` (2026-10-19) — טבלת `rate_limits` משותפת.
- S-23: `sweep()` ב-`lib/rate-limit.ts` מנקה את כל המפתחות לפי חלון הקריאה הנוכחית — חלון 15 הדק' של מפתח האימייל בהתחברות מתקצר בפועל ל-10 דק'. VERIFIED (קוד). חומרה נמוכה. **FIXED** — נפרס ב-`8a7eb18` (2026-10-19) (ה-Map הוסר).
- UX-01 (נמצא ע"י E2E, 2026-10-19): React 19 מאפס כל טופס `<form action>` אחרי Server Action. בהצלחה זה תקין (הערכים נטענים מחדש מהשרת), אבל **בשגיאה המשתמש מאבד את מה שהקליד** — 22 טפסים עם `useActionState` (מוצרים, הגדרות, משתלות, עמודים, בלוג...). VERIFIED בטופס ההתחברות (תוקן בענף `chore/playwright-e2e`); בשאר הטפסים — לפי אותו מנגנון, טרם נבדק אחד-אחד. לא אבטחה — חוויית משתמש. OPEN — משימה נפרדת.
