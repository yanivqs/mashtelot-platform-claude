# Gap Analysis מול Master Specification V2

מקור: `Nursery_Master_Spec_V2_HE.docx` (16.10.2026). קוד: `c337f19`.
סטטוס לפי §37: **Verified** (נבדק בקוד) · **Partial** · **Missing** · **Conflict** · **Unknown** (דורש סביבה).
"Verified" כאן = הקוד קיים ונבדק בקריאה; אינו "מוכן לייצור" ללא בדיקות קבלה (§36).

## פלטפורמה, Tenant, הרשאות ואבטחה
| דרישה | שלב | סטטוס | ראיה | בדיקה נדרשת |
|---|---|---|---|---|
| §1.01 / R10-02 Monorepo | BLOCKER | Conflict | אפליקציה יחידה | ADR-01 |
| §1.03 / R10-03 tenant_id + RLS | BLOCKER | Partial | `nurseryId` בכל ישות; 11 טבלאות ללא RLS | anon/auth API |
| §1.04, §21 Jobs/Queue | BLOCKER | Missing | אין cron/queue | — |
| §1.05, §22.07 הפרדת סביבות | BLOCKER | Partial | E01 (בדיקות) בענף; Preview — Unknown | env של Vercel |
| §2.01 זיהוי Tenant בשרת | BLOCKER | Verified | `middleware.ts`, `lib/tenant.ts` | זיוף Host |
| §2.03 Lifecycle משתלה | BLOCKER | Partial | `isActive` בלבד; בעלים מושעה מתחבר | Tenant C |
| §2.05 Tenants סינתטיים | BLOCKER | Partial | `test/db/fixtures.ts` (בענף E01) | — |
| §4.01 / R06-01 תפקידים | BLOCKER | Partial (2026-10-20) | צוות משתלה: עובד + כותב תוכן, עד 5 (`lib/nursery-team.ts`); תפקידי צוות הפלטפורמה (§4.01) — טרם | E2E `team.desktop.spec.ts` |
| §4.04 MFA | BLOCKER | Partial (2026-10-20) | TOTP + קודי שחזור (`lib/mfa.ts`); **החלטת בעלים: אופציונלי גם לסופר-אדמין — חריגה מ"מחייב בחשבונות ניהול מרכזיים"** | E2E `mfa.desktop.spec.ts` |
| §4.07 אכיפה בשרת | BLOCKER | Partial | IDOR בעמודים; מודולים לא באכיפת Actions | בדיקות שליליות |
| §10.01 Credentials מוצפנים לכל Tenant | BLOCKER | Missing | אין סליקה | — |
| §19.02 Secrets | BLOCKER | Partial | `.env` מוחרג; סיסמאות seed קשיחות | סריקת סודות |
| §20 Audit | BLOCKER | Partial | `lib/audit.ts` — מחיר/מלאי/תשלום/מייל בלבד | — |
| §23.06 גיבוי ושחזור | BLOCKER | Unknown | — | תרגיל שחזור |

## קטלוג, מוצרים, מלאי
| דרישה | שלב | סטטוס | ראיה |
|---|---|---|---|
| §5.02 / R09-05 CSV Dry-run + Hash | ROLLOUT | Verified | `catalog/import/`, `lib/plant-import.ts` |
| §6 / R02-02 הצעות סנכרון | ROLLOUT | Partial | קישור `plantId` + Overrides; אין הצעות |
| §7.01 / R02-03 וריאנטים | MVP | Missing | `NurseryProduct` שטוח |
| §7.03 / R04-01 קטגוריות בעץ + סדר | MVP | Verified | `NurseryCategory`, `lib/category-tree.ts` |
| §7.04 / R04-02 מסננים דינמיים | MVP | Verified | `lib/plant-facets.ts`, `lib/catalog-filter.ts` |
| R04-03 חיפוש נרדפות/שגיאות | MVP | Missing | תת-מחרוזת בלבד |
| R04-07 מיון מחיר/שם/תאריך | MVP | Verified (2026-10-20) | `lib/catalog-filter.ts` `CATALOG_SORTS` |
| R04-08 אזל = מוצג ולא נרכש | MVP | Verified | `product/[slug]/page.tsx` `disabled={outOfStock}` + בדיקת שרת |
| §8.01-02 on_hand/reserved + תנועות | BLOCKER | Missing | — |
| §8.03 ללא Oversell במקביל | BLOCKER | Verified | `updateMany` מותנה; smoke test (כעת מבודד) |
| R05-08 שמירה בשלב תשלום עם פקיעה | BLOCKER | Conflict | ירידה מיידית ביצירת הזמנה |
| §8.06 החזרה בביטול | BLOCKER | Missing | `orders/actions.ts` |

## Checkout, תשלום, משלוח, קופונים
| דרישה | שלב | סטטוס | ראיה |
|---|---|---|---|
| §9.02 חישוב בשרת | BLOCKER | Verified | `lib/checkout-calc.ts` + בדיקות |
| §9.03 Snapshot | BLOCKER | Partial | אין קופון/הנחה על `Order` |
| §9.04 State machine | BLOCKER | Missing | רשימת `VALID` בלבד |
| R05-07 סטטוסים | MVP | Conflict | enum שונה (אין "אושרה"/"מוכנה") |
| §9 Idempotency הזמנה | BLOCKER | Missing | — |
| §10.02 / §21.02 Webhooks | BLOCKER | Missing | — |
| §10.03 / R05-06 תשלום ידני | MVP | Partial | Bit/PayBox/העברה; אין PayPal/באיסוף/אשראי |
| §11.01 / R05-03 משלוח עיר+מיקוד | MVP | Verified (2026-10-20) | `lib/shipping-zones.ts`, `shipping_zone_postcodes` |
| R05-05 נקודת איסוף אחת | MVP | Verified | `Nursery.pickupEnabled` |
| §12.01 קופון: מינימום/ללקוח | MVP | Partial | יש תוקף ומכסה כוללת (אטומית) |
| R05-10 הודעות עסקה | MVP | Partial | מייל (Resend; אימות דומיין Unknown) |

## Storefront, SEO, Admin, מודולים
| דרישה | שלב | סטטוס | ראיה |
|---|---|---|---|
| §3 / R03-04 Theme, Hero, קרוסלה | MVP | Verified | `lib/theme.ts`, `hero-carousel.tsx` |
| R03 Page Builder | הרחבה | Missing | — |
| R01-04 ניווט תחתון במובייל | MVP | Missing | — |
| §13 / R06-04 חשבון לקוח | LATER | Missing | `CUSTOMER` לא בשימוש |
| §14.01 Canonical/Meta | MVP | Verified | `generateMetadata` |
| §14.01 Sitemap/Robots/301 | MVP | Missing | — |
| §14.03 Product/LocalBusiness Schema | MVP | Verified | `lib/seo.ts` |
| §14.04 Preview noindex | MVP | Unknown | — |
| §16 מודולים חסומים בעקיפת API | ROLLOUT | Partial | נאכף בדפים בלבד |
| §22 CI | BLOCKER | Missing | אין `.github/` |

## מודול תבניות דפוס (נספח א׳, §34)
| ID | סטטוס | ראיה |
|---|---|---|
| PT-01 הפרדה B2B/חנות | Verified | `PrintOrder` נפרד, Admin בלבד |
| PT-02 גרסאות בלתי משתנות | Missing | `PrintProduct` נערך במקום |
| PT-03 שדות דינמיים + ולידציה בשרת | Missing | `customText` + אפשרויות גימור |
| PT-04 מוצר קבוע + Revision | Missing | — |
| PT-05 Artwork/Proof | Missing | `artworkUrl` יחיד, ציבורי |
| PT-06 שחרור לייצור + Audit | Partial | סטטוסים ללא שערים/Audit |
| PT-07 תמחור בשרת + Snapshot | Partial | `lib/print-pricing.ts`; אין Quote-only |
| PT-08 Storage פרטי | Missing | bucket ציבורי |
| PT-09..11 | Missing | שלבי פיילוט ואילך |
