-- R06-01/02: צוות משתלה — עובד וכותב תוכן (עד 5 למשתלה, נאכף בשרת) — Expand בלבד.
-- משתמשים קיימים לא משתנים.
-- שחזור: Revert הקוד (הקוד הישן מתייחס רק ל-SUPER_ADMIN/NURSERY_OWNER, כך שמשתמשי צוות לא יוכלו להתחבר).
--   הסרה מלאה (לא מורץ): DELETE/UPDATE משתמשי הצוות, ALTER TABLE "users" DROP CONSTRAINT "users_staff_requires_nursery",
--   DROP COLUMN "disabled_at". ערכי ה-enum נשארים (הסרת ערך enum ב-Postgres מחייבת יצירת הטיפוס מחדש — לא נדרש).

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'NURSERY_STAFF';
ALTER TYPE "Role" ADD VALUE 'NURSERY_WRITER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabled_at" TIMESTAMP(3);

-- משתמש צוות חייב להיות משויך למשתלה (השוואה כטקסט — ערך enum חדש אינו שמיש באותה טרנזקציה)
ALTER TABLE "users" ADD CONSTRAINT "users_staff_requires_nursery"
  CHECK ("role"::text NOT IN ('NURSERY_STAFF', 'NURSERY_WRITER') OR "nursery_id" IS NOT NULL);
