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
