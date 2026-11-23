-- ספקים ויצרנים (החלטת בעלים 2026-11-23): טבלת manufacturers, יצרן + קוד יצרן + מחיר מומלץ במוצר הציוד המרכזי,
-- ויצרן + קוד יצרן במוצר של משתלה. Expand בלבד, ועוד המרה: כל ערך brand קיים הופך ליצרן ומקושר.
-- supply_content_json לא משתנה — הקישור ליצרן לא יוצר גרסת קטלוג חדשה ולא "עדכון מהקטלוג" למשתלות.
-- הסרה מלאה (לא מורץ): ALTER TABLE "nursery_products" DROP COLUMN "manufacturer_id", DROP COLUMN "manufacturer_code";
--   ALTER TABLE "master_supplies" DROP COLUMN "manufacturer_id", DROP COLUMN "manufacturer_code", DROP COLUMN "suggested_price";
--   DROP TABLE "manufacturers";

-- AlterTable
ALTER TABLE "master_supplies" ADD COLUMN     "manufacturer_code" TEXT,
ADD COLUMN     "manufacturer_id" TEXT,
ADD COLUMN     "suggested_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "nursery_products" ADD COLUMN     "manufacturer_code" TEXT,
ADD COLUMN     "manufacturer_id" TEXT;

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "website" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_name_key" ON "manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_slug_key" ON "manufacturers"("slug");

-- CreateIndex
CREATE INDEX "master_supplies_manufacturer_id_idx" ON "master_supplies"("manufacturer_id");

-- CreateIndex
CREATE INDEX "nursery_products_manufacturer_id_idx" ON "nursery_products"("manufacturer_id");

-- AddForeignKey
ALTER TABLE "master_supplies" ADD CONSTRAINT "master_supplies_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_products" ADD CONSTRAINT "nursery_products_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- הגישה רק דרך השרת
ALTER TABLE "manufacturers" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "manufacturers" FROM anon, authenticated;
  END IF;
END $$;

-- המרת המותגים הקיימים ליצרנים (slug: רווחים ו-/ למקף; כפילות — סיומת מה-hash)
WITH names AS (
  SELECT DISTINCT btrim("brand") AS name FROM "master_supplies" WHERE btrim(COALESCE("brand", '')) <> ''
), slugs AS (
  SELECT name,
         btrim(regexp_replace(regexp_replace(lower(name), '["''׳״.,()]', '', 'g'), '[\s/\&+]+', '-', 'g'), '-') AS base
  FROM names
), ranked AS (
  SELECT name, base, row_number() OVER (PARTITION BY base ORDER BY name) AS rn FROM slugs
)
INSERT INTO "manufacturers" ("id", "name", "slug", "updated_at")
SELECT gen_random_uuid()::text, name,
       CASE WHEN base = '' OR rn > 1 THEN COALESCE(NULLIF(base, ''), 'm') || '-' || substr(md5(name), 1, 6) ELSE base END,
       CURRENT_TIMESTAMP
FROM ranked;

UPDATE "master_supplies" s SET "manufacturer_id" = m."id"
FROM "manufacturers" m WHERE m."name" = btrim(s."brand");

UPDATE "nursery_products" p SET "manufacturer_id" = s."manufacturer_id"
FROM "master_supplies" s WHERE p."supply_id" = s."id" AND s."manufacturer_id" IS NOT NULL AND p."manufacturer_id" IS NULL;
