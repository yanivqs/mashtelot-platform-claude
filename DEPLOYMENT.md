# העלאה לאונליין (Deployment)

הפלטפורמה בנויה Next.js 14 + Prisma + Postgres (Supabase). הדרך המהירה
והזולה לפרוס אותה עם תמיכה מלאה בריבוי דומיינים היא **Vercel + Supabase**.

---

## 1. דרישות מקדימות

- חשבון GitHub (הקוד צריך להיות ב-repo)
- חשבון [Vercel](https://vercel.com) (חינם לפרויקט אישי)
- מסד הנתונים ב-Supabase כבר קיים (זה שמוגדר ב-`.env` המקומי)
- דומיין בבעלותך, למשל `mashtelot.com` (מכל רשם — GoDaddy / Namecheap / Cloudflare / name.com)

---

## 2. הכנת הקוד

הריפו: `https://github.com/yanivqs/mashtelot-platform-claude` (שורש הריפו = תיקיית
האפליקציה, כלומר תוכן `nursery-platform/`).

```bash
git add -A && git commit -m "prepare for deploy"
git push origin main
```

ודא שקיים `prisma/migrations/` עם כל המיגרציות (יש) — בפרודקשן מריצים
`prisma migrate deploy`, לא `db push`.

---

## 3. פריסה ב-Vercel

1. **vercel.com → Add New → Project → Import** את ה-repo `mashtelot-platform-claude` מ-GitHub.
2. Framework Preset: **Next.js** (מזוהה אוטומטית). Root Directory: `./` (שורש הריפו).
3. **Build Command** — השאר על ברירת המחדל. ה-`package.json` כולל סקריפט
   `vercel-build` (`prisma generate && prisma migrate deploy && next build`)
   ש-Vercel מריץ אוטומטית, ו-`postinstall` שמריץ `prisma generate`.
   אל תוסיף את אינטגרציית **Prisma Postgres** — משתמשים ב-Supabase הקיים.
4. **Environment Variables** — הוסף את כולם (Production + Preview):

   | משתנה | ערך |
   |---|---|
   | `DATABASE_URL` | מחרוזת ה-**transaction pooler** של Supabase (פורט 6543, עם `?pgbouncer=true`) |
   | `DIRECT_URL` | מחרוזת ה-**session pooler** של Supabase (פורט 5432) — משמש למיגרציות |
   | `AUTH_SECRET` | מחרוזת אקראית: `openssl rand -hex 32` |
   | `ROOT_DOMAIN` | `mashtelot.com` (הדומיין שלך, **בלי** `https://`) |

5. **Deploy**. בסיום תקבל כתובת `xxx.vercel.app`.

---

## 4. חיבור הדומיין + תת-דומיינים (הקריטי לריבוי-משתלות)

ב-**Vercel → Project → Settings → Domains** הוסף:

| דומיין | סוג |
|---|---|
| `mashtelot.com` | הדומיין הראשי (Landing + `/admin`) |
| `www.mashtelot.com` | Redirect ל-apex |
| `*.mashtelot.com` | **Wildcard** — נותן לכל משתלה תת-דומיין (`galim.mashtelot.com`) אוטומטית |

Vercel יציג את רשומות ה-DNS שצריך להגדיר אצל הרשם:

- `A` record ל-`@` → `76.76.21.21`
- `CNAME` ל-`*` → `cname.vercel-dns.com`
- `CNAME` ל-`www` → `cname.vercel-dns.com`

ה-wildcard מקבל תעודת SSL אוטומטית מ-Vercel. אחרי שה-DNS מתעדכן
(עד 48 שעות, בד"כ דקות), כל `<subdomain>.mashtelot.com` יגיע ל-middleware,
שיזהה את המשתלה לפי ה-`subdomain` בטבלת `nurseries`.

### דומיין מותאם אישית למשתלה (`www.galim-nursery.co.il`)

1. בעל המשתלה מוסיף אצל הרשם שלו `CNAME` → `cname.vercel-dns.com`.
2. מוסיפים את הדומיין ב-Vercel → Domains.
3. מעדכנים ברשומת המשתלה את השדה `custom_domain` (דרך `/admin/nurseries`
   או ישירות ב-DB). ה-middleware כבר תומך בזה.

---

## 5. אחרי הפריסה הראשונה — זריעת נתונים

המיגרציות רצות אוטומטית ב-build. את הנתונים זורעים פעם אחת מהמחשב המקומי
(מול אותו `DIRECT_URL` של פרודקשן), או דרך Supabase SQL editor:

```bash
npm run db:seed:all      # צמחים + ציוד + דפוס + משתלת דמו + משתמשי אדמין
```

⚠️ **החלף את הסיסמאות** ב-`seed-admin.js` לפני הרצה בפרודקשן, או צור את
המשתמשים ידנית. `seed.js` (משתלת דמו) — לא חובה בפרודקשן.

---

## 6. Supabase — הגדרות פרודקשן

- **Connection Pooling** חייב להיות מופעל (ברירת מחדל). האפליקציה משתמשת
  ב-transaction pooler; המיגרציות ב-session pooler.
- ב-**Settings → Database** ודא ש-"Enforce SSL" מופעל.
- שקול לשדרג מ-Free ל-Pro אם צפויה תנועה (Free עוצר את ה-DB אחרי חוסר
  פעילות ומגביל חיבורים).

---

## 7. בדיקת עשן אחרי פריסה

- `https://mashtelot.com` → דף נחיתה
- `https://demo-nursery.mashtelot.com` → חנות (אם נזרעה)
- `https://mashtelot.com/admin` → כניסה, ואז דשבורד
- עמוד מוצר → בדוק `view-source` שיש `<link rel="canonical">` ו-JSON-LD
- הזמנה מלאה: קטלוג → עגלה → תשלום → אישור → מופיע ב-`/admin/orders`

---

## 8. אלטרנטיבות ל-Vercel

| פלטפורמה | הערות |
|---|---|
| **Netlify** | תומך Next 14; wildcard domains ב-Pro |
| **Railway / Render** | מריצים `next start` בקונטיינר; wildcard דורש הגדרת DNS ידנית + reverse proxy |
| **VPS + Docker + Nginx** | הכי הרבה שליטה, הכי הרבה תחזוקה; צריך `certbot` עם wildcard (DNS-01 challenge) |

לרוב המקרים Vercel הוא הבחירה הנכונה כאן — הוא מטפל ב-SSL של ה-wildcard,
ב-ISR ובקנה-מידה אוטומטית ללא הגדרות.

---

## מה עדיין חסר לפרודקשן אמיתי

- **סליקת אשראי** — כרגע הזמנות נוצרות כ-`PENDING` ומשולמות מול המשתלה.
  לשילוב: Stripe / Tranzila / Cardcom ב-`checkout/actions.ts`.
- **מיילים טרנזקציוניים** — אישור הזמנה ללקוח, התראה למשתלה (Resend / SendGrid).
- **אחסון קבצים** — העלאת לוגו/תמונות (Supabase Storage / Vercel Blob) במקום URLs.
- **Rate limiting** על ה-login ועל יצירת הזמנות.
