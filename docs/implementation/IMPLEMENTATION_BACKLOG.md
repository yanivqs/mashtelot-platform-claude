# Backlog ביצוע

סדר לפי `Nursery_Claude_Code_Development_Plan_HE.docx` §3–4; דרישות לפי Master Spec V2.
משימה מסומנת DONE רק אחרי עמידה בבדיקות הקבלה ומיזוג ל-main.
סטטוסים: TODO · IN_PROGRESS · IN_REVIEW (ממתין לאישור/מיזוג) · DONE · BLOCKED.

| ID | משימה | דרישות | תלות | סטטוס |
|---|---|---|---|---|
| E01 / C-P0-04 | סביבת בדיקות מבודדת: guard ל-TEST_DATABASE_URL, פיצול unit/db, fixtures A/B/C | §22.04, §2.05, §38 | — | IN_REVIEW (`chore/e01-test-isolation`) |
| C-P0-01 | IDOR בעמודים סטטיים + בדיקות A/B | §4.07, §19.01 | E01 | IN_REVIEW (`fix/c-p0-01-static-pages-idor`) |
| C-P0-02 | RLS ל-11 טבלאות + בדיקה שאוסרת טבלה חדשה בלי RLS; בדיקת anon/authenticated מול `mashtelot-dev` | §1.03, R10-03 | E01 | TODO |
| C-P0-03 | הסרת סיסמאות קשיחות מ-seed, guard נגד seed בפרודקשן; אימות רוטציה (בעלים) | §19.02 | E01 | TODO |
| C-P0-05 | מיגרציות רק במסלול מאושר; Preview → `mashtelot-dev` | §1.05, §22.07, §23.02 | E01 | TODO |
| C-P1-01 | שכבת הרשאות מרוכזת: משתלה מפורשת לסופר-אדמין, אכיפת מודולים בכל Action, חסימת משתלה מושעית | §4.07, §16 קבלה, §2.03 | C-P0-01 | TODO |
| C-P1-04 | CI: typecheck, unit, בדיקות בידוד; חסימת PR | §22.01 | E01 | TODO |
| C-P1-02 | מלאי וביטולים: החזרת מלאי/קופון, Idempotency, Snapshot הנחה, state machine, שמירת מלאי בשלב תשלום עם פקיעה | §8, §9, R05-07/08 | C-P1-01 | TODO |
| C-P1-05 | SEO: sitemap/robots לכל tenant | §14.01, R07 | — | TODO |
| C-P1-03 | שדרוג Next.js (ADR) + צמצום remotePatterns | R10-01 | C-P1-04 | TODO |
| OPS-01 | תרגיל גיבוי ושחזור מתועד | §23.06, §38 | — | TODO (לא בתוכנית Claude Code — הוצע) |
| OPS-02 | Vercel Function Region → fra1 | ביצועים | — | TODO (הוצע) |
| ADR-01 | Monorepo (§1.01/R10-02) מול אפליקציה יחידה | §1.01 | — | ממתין להחלטת בעלים |
| C-P2-01 | תשתית סליקה: sandbox, webhook חתום, idempotency | §10, §21 | C-P1-02 | TODO |
| C-PT-01..04 | מודול תבניות דפוס (Workstream נפרד) | PT-01..PT-10 | C-P1-01 | TODO |

## פערים בין תוכנית הפיתוח לאפיון (דווחו לבעלים, טרם הוכרעו)
- Monorepo (§1.01) — אין משימה בתוכנית.
- BLOCKERs באפיון ללא משימה בתוכנית: גיבוי/שחזור (§23.06), Jobs (§21), MFA (§4.04), הצפנת Credentials לכל Tenant (§10.01), Lifecycle משתלה (§2.03).
- §1.02 מזכיר Supabase Auth; המערכת משתמשת ב-JWT עצמאי (מומלץ ADR לשימור).
