-- §6 / R02-02: גרסאות לקטלוג המרכזי והצעות סנכרון — Expand בלבד.
-- 1. catalog_revisions (צילום תוכן של צמח/ציוד לכל שינוי), catalog_sync_decisions (תיעוד §6.05),
--    nursery_products.catalog_revision_id (הגרסה שאושרה) + catalog_overrides (שדות שנשמרו מקומית).
-- 2. Backfill: גרסה 1 לכל פריט מרכזי = הנתונים הנוכחיים; כל מוצר מקושר נעוץ לגרסה 1 → אין שינוי נראה לעין.
-- 3. Triggers: שינוי תוכן ב-plants/master_supplies → גרסה חדשה; מוצר מקושר חדש → נעוץ לגרסה האחרונה.
-- 4. אימות בסוף — אחרת RAISE והמיגרציה כולה מתבטלת.
-- שחזור: Revert הקוד — plants/master_supplies נשארים המקור העדכני והקוד הקודם קורא מהם.
--   הסרה מלאה (לא מורץ): DROP TRIGGER plants_record_revision ON plants; DROP TRIGGER master_supplies_record_revision ON master_supplies;
--   DROP TRIGGER nursery_products_pin_catalog_revision ON nursery_products; DROP FUNCTION record_plant_revision(), record_supply_revision(),
--   pin_product_catalog_revision(), plant_content_json(plants), supply_content_json(master_supplies);
--   ALTER TABLE nursery_products DROP COLUMN catalog_revision_id, DROP COLUMN catalog_overrides;
--   DROP TABLE catalog_sync_decisions; DROP TABLE catalog_revisions;

-- AlterTable
ALTER TABLE "nursery_products" ADD COLUMN     "catalog_overrides" JSONB,
ADD COLUMN     "catalog_revision_id" TEXT;

-- CreateTable
CREATE TABLE "catalog_revisions" (
    "id" TEXT NOT NULL,
    "plant_id" TEXT,
    "supply_id" TEXT,
    "version" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "actor_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_sync_decisions" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "nursery_product_id" TEXT NOT NULL,
    "from_revision_id" TEXT,
    "to_revision_id" TEXT NOT NULL,
    "accepted" TEXT[],
    "rejected" TEXT[],
    "actor_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_sync_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_revisions_plant_id_version_key" ON "catalog_revisions"("plant_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_revisions_supply_id_version_key" ON "catalog_revisions"("supply_id", "version");

-- CreateIndex
CREATE INDEX "catalog_sync_decisions_nursery_id_created_at_idx" ON "catalog_sync_decisions"("nursery_id", "created_at");

-- AddForeignKey
ALTER TABLE "nursery_products" ADD CONSTRAINT "nursery_products_catalog_revision_id_fkey" FOREIGN KEY ("catalog_revision_id") REFERENCES "catalog_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_revisions" ADD CONSTRAINT "catalog_revisions_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_revisions" ADD CONSTRAINT "catalog_revisions_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "master_supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_sync_decisions" ADD CONSTRAINT "catalog_sync_decisions_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_sync_decisions" ADD CONSTRAINT "catalog_sync_decisions_nursery_product_id_fkey" FOREIGN KEY ("nursery_product_id") REFERENCES "nursery_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "catalog_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_sync_decisions" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "catalog_revisions" FROM anon, authenticated;
    REVOKE ALL ON TABLE "catalog_sync_decisions" FROM anon, authenticated;
  END IF;
END $$;

-- שדות התוכן של פריט מרכזי (מסונכרנים בהצעות). מחיר/מלאי/SKU וכו' — ברמת המשתלה, לא כאן (§6.04).
CREATE FUNCTION plant_content_json(r "plants") RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'hebrewName', r."hebrew_name", 'latinName', r."latin_name", 'nickname', r."nickname", 'family', r."family",
    'description', r."description", 'notes', r."notes", 'origin', r."origin", 'native', r."native",
    'plantType', r."plant_type", 'light', r."light", 'water', r."water", 'flowering', r."flowering",
    'floweringSeason', r."flowering_season", 'flowerColor', r."flower_color", 'foliage', r."foliage",
    'evergreen', r."evergreen", 'height', r."height", 'spacing', r."spacing", 'growthRate', r."growth_rate",
    'climateZones', r."climate_zones", 'resistance', r."resistance", 'coastal', r."coastal", 'care', r."care",
    'uniqueness', r."uniqueness", 'imageUrl', r."image_url")
$$;

CREATE FUNCTION supply_content_json(r "master_supplies") RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'title', r."title", 'brand', r."brand", 'category', r."category"::text,
    'description', r."description", 'imageUrl', r."image_url")
$$;

-- Backfill: גרסה 1 לכל פריט מרכזי = הנתונים הנוכחיים
INSERT INTO "catalog_revisions" ("id", "plant_id", "version", "data", "source")
SELECT gen_random_uuid()::text, p."id", 1, plant_content_json(p), 'backfill' FROM "plants" p;

INSERT INTO "catalog_revisions" ("id", "supply_id", "version", "data", "source")
SELECT gen_random_uuid()::text, s."id", 1, supply_content_json(s), 'backfill' FROM "master_supplies" s;

UPDATE "nursery_products" np SET "catalog_revision_id" = r."id"
FROM "catalog_revisions" r
WHERE r."version" = 1 AND ((np."plant_id" IS NOT NULL AND r."plant_id" = np."plant_id")
                        OR (np."supply_id" IS NOT NULL AND r."supply_id" = np."supply_id"));

-- Trigger: שינוי תוכן בפריט מרכזי → גרסה חדשה (רק אם התוכן השתנה).
-- מקור/מבצע: set_config('app.catalog_source' / 'app.catalog_actor', ..., true) בטרנזקציה, אחרת 'system'.
CREATE FUNCTION record_plant_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE content jsonb; last_version int; last_data jsonb;
BEGIN
  content := plant_content_json(NEW);
  SELECT "version", "data" INTO last_version, last_data
  FROM "catalog_revisions" WHERE "plant_id" = NEW."id" ORDER BY "version" DESC LIMIT 1;
  IF last_version IS NULL OR last_data IS DISTINCT FROM content THEN
    INSERT INTO "catalog_revisions" ("id", "plant_id", "version", "data", "source", "actor_email")
    VALUES (gen_random_uuid()::text, NEW."id", COALESCE(last_version, 0) + 1, content,
            COALESCE(NULLIF(current_setting('app.catalog_source', true), ''), 'system'),
            NULLIF(current_setting('app.catalog_actor', true), ''));
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER plants_record_revision
AFTER INSERT OR UPDATE ON "plants"
FOR EACH ROW EXECUTE FUNCTION record_plant_revision();

CREATE FUNCTION record_supply_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE content jsonb; last_version int; last_data jsonb;
BEGIN
  content := supply_content_json(NEW);
  SELECT "version", "data" INTO last_version, last_data
  FROM "catalog_revisions" WHERE "supply_id" = NEW."id" ORDER BY "version" DESC LIMIT 1;
  IF last_version IS NULL OR last_data IS DISTINCT FROM content THEN
    INSERT INTO "catalog_revisions" ("id", "supply_id", "version", "data", "source", "actor_email")
    VALUES (gen_random_uuid()::text, NEW."id", COALESCE(last_version, 0) + 1, content,
            COALESCE(NULLIF(current_setting('app.catalog_source', true), ''), 'system'),
            NULLIF(current_setting('app.catalog_actor', true), ''));
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER master_supplies_record_revision
AFTER INSERT OR UPDATE ON "master_supplies"
FOR EACH ROW EXECUTE FUNCTION record_supply_revision();

-- Trigger: מוצר חדש שמקושר לפריט מרכזי → נעוץ לגרסה האחרונה
CREATE FUNCTION pin_product_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."catalog_revision_id" IS NULL THEN
    IF NEW."plant_id" IS NOT NULL THEN
      SELECT "id" INTO NEW."catalog_revision_id" FROM "catalog_revisions"
      WHERE "plant_id" = NEW."plant_id" ORDER BY "version" DESC LIMIT 1;
    ELSIF NEW."supply_id" IS NOT NULL THEN
      SELECT "id" INTO NEW."catalog_revision_id" FROM "catalog_revisions"
      WHERE "supply_id" = NEW."supply_id" ORDER BY "version" DESC LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER nursery_products_pin_catalog_revision
BEFORE INSERT ON "nursery_products"
FOR EACH ROW EXECUTE FUNCTION pin_product_catalog_revision();

-- אימות: כל פריט מרכזי עם גרסה תואמת, וכל מוצר מקושר נעוץ לגרסה של הפריט שלו
DO $$
DECLARE bad_plants int; bad_supplies int; bad_products int;
BEGIN
  SELECT count(*) INTO bad_plants FROM "plants" p
  LEFT JOIN "catalog_revisions" r ON r."plant_id" = p."id" AND r."version" = 1
  WHERE r."id" IS NULL OR r."data" IS DISTINCT FROM plant_content_json(p);
  SELECT count(*) INTO bad_supplies FROM "master_supplies" s
  LEFT JOIN "catalog_revisions" r ON r."supply_id" = s."id" AND r."version" = 1
  WHERE r."id" IS NULL OR r."data" IS DISTINCT FROM supply_content_json(s);
  SELECT count(*) INTO bad_products FROM "nursery_products" np
  LEFT JOIN "catalog_revisions" r ON r."id" = np."catalog_revision_id"
  WHERE (np."plant_id" IS NOT NULL OR np."supply_id" IS NOT NULL)
    AND (r."id" IS NULL OR r."plant_id" IS DISTINCT FROM np."plant_id" OR r."supply_id" IS DISTINCT FROM np."supply_id");
  IF bad_plants > 0 OR bad_supplies > 0 OR bad_products > 0 THEN
    RAISE EXCEPTION 'catalog revisions backfill verification failed: plants=%, supplies=%, products=%', bad_plants, bad_supplies, bad_products;
  END IF;
END $$;
