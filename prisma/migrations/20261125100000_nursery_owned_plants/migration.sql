-- צמחים פרטיים של משתלה: בעל משתלה יוצר צמח עם כל הנתונים הבוטניים. הצמח מוצג רק בחנות שלו
-- (owner_nursery_id), ויכול להיות מוצע לקטלוג הראשי (submitted_at). קידום = owner_nursery_id NULL.
-- תוספות בלבד: כל הצמחים הקיימים נשארים בקטלוג הראשי (NULL).

ALTER TABLE "plants" ADD COLUMN "owner_nursery_id" TEXT,
ADD COLUMN "submitted_at" TIMESTAMP(3);

CREATE INDEX "plants_owner_nursery_id_idx" ON "plants"("owner_nursery_id");

ALTER TABLE "plants" ADD CONSTRAINT "plants_owner_nursery_id_fkey" FOREIGN KEY ("owner_nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
