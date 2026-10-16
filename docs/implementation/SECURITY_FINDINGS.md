# ממצאי אבטחה

מקור דרישות: `Nursery_Master_Spec_V2_HE.docx` (§1, §2, §4, §19, §22, §38).
מקרא אימות: **VERIFIED** = נבדק בקוד/בבדיקה · **REPORTED** = מדוח קודם, לא אומת מחדש · **UNKNOWN** = לא ניתן לאימות מהריפו (דורש גישה לסביבה).
קוד בסיס: `c337f19` (main). עודכן: 2026-10-16.

| ID | ממצא | חומרה | אימות | ראיה | סטטוס | משימה |
|---|---|---|---|---|---|---|
| P0-1 | IDOR: עדכון עמוד סטטי לפי `id` ללא בדיקת `nurseryId` | גבוהה | VERIFIED | `app/admin/(dash)/pages/actions.ts:79` | **FIXED בענף** `fix/c-p0-01-static-pages-idor` — ממתין למיזוג | C-P0-01 |
| P0-2 | 11 טבלאות ללא RLS: `nursery_payment_methods`, `audit_events`, `nursery_channels`, `shipping_zones`, `shipping_zone_cities`, `plant_categories`, `plant_category_assignments`, `import_jobs`, `nursery_categories`, `nursery_product_categories`, `blog_posts` | **קריטית** | VERIFIED — שוחזר ב-`mashtelot-dev`: anon קרא/כתב/מחק דרך default privileges של Supabase. בפרודקשן: UNKNOWN (אותה תצורת ברירת מחדל צפויה) | + `_prisma_migrations` (anon יכול היה למחוק את היסטוריית המיגרציות) | **FIXED בענף** `fix/c-p0-02-rls` — אומת ב-dev; ממתין לאישור החלה בפרודקשן | C-P0-02 |
| P0-3 | סיסמאות קשיחות ב-seed (`admin1234`, `owner1234`) | גבוהה | VERIFIED בקוד · UNKNOWN בפרודקשן | `seed-admin.js:10-12` | OPEN — נדרש אימות בעלים | C-P0-03 |
| P0-4 | בדיקות DB ללא הפרדה מ-Production; `test/setup.ts` טען את `.env` לכל ריצת בדיקות | גבוהה | VERIFIED | `test/setup.ts` (הוסר), `vitest.config.ts` | **FIXED בענף** `chore/e01-test-isolation` — ממתין למיזוג | E01 |
| P0-5 | `prisma migrate deploy` רץ בכל build, כולל Preview | גבוהה | VERIFIED בקוד · UNKNOWN אם ל-Preview יש DATABASE_URL נפרד | `package.json` `vercel-build` | OPEN | C-P0-05 |
| P0-6 | אכיפת מודולים רק בדפים, לא ב-Server Actions | בינונית | VERIFIED | רק blog/pages/categories קוראים ל-`requireModule` | OPEN | C-P1-01 |
| P0-7 | ברירת מחדל ל"משתלה הראשונה" בפעולות סופר-אדמין | בינונית | VERIFIED (24 מופעים) | `findFirst({ orderBy: { createdAt: 'asc' } })` | OPEN | C-P1-01 |
| P0-8 | בעלים של משתלה מושעית מתחבר לפורטל | בינונית | VERIFIED | `app/admin/login/actions.ts` אינו בודק `nursery.isActive` | OPEN | C-P1-01 |
| P0-9 | אין Idempotency ביצירת הזמנה (שליחה כפולה = שתי הזמנות) | בינונית | VERIFIED | `app/[tenant]/checkout/actions.ts` | OPEN | C-P1-02 |
| S-10 | Next.js 14.2.35 — advisories שתיקונם רק ב-16.x; `images.remotePatterns: '**'` | גבוהה | REPORTED (npm audit, 2026-09-18) | `package.json`, `next.config.js` | OPEN | C-P1-03 |
| S-11 | bucket אחסון ציבורי (כולל artwork של דפוס) | בינונית | VERIFIED | `lib/upload-actions.ts` | OPEN | C-PT-03 (PT-08) |
| S-12 | `log: ['query']` ב-Prisma גם בפרודקשן | נמוכה | VERIFIED | `lib/prisma.ts` | OPEN | — |
| S-13 | Vercel Functions ב-`iad1` מול DB ב-`eu-central-1` (ביצועים) | נמוכה (ביצועים) | VERIFIED (`x-vercel-id`, host ה-DB) | header חי + `.env` | OPEN | הצעה נפרדת |
| S-14 | `next build` מקומי מבצע prerender שקורא (קריאה בלבד) מבסיס ה-Production דרך `.env` | נמוכה | VERIFIED (build של C-P0-01) | `app/page.tsx` (revalidate 3600) | OPEN | C-P0-05 |

## הנחות שטרם נבדקו
- ה-anon key של פרויקט ה-Production לא דלף (אינו בריפו; לא נבדק מעבר לזה).
- גיבויים/PITR בפרויקט ה-Production — תלוי במסלול Supabase; אין תרגיל שחזור מתועד.
