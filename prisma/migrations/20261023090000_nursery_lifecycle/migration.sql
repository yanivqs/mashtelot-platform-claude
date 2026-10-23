-- §2.03: מחזור חיים של משתלה — טיוטה / פעילה / מושעית / ארכיון. Expand: עמודה חדשה + מילוי מהשדה הקיים.
-- מילוי: is_active=true → ACTIVE, is_active=false → SUSPENDED (כפי שהן מוצגות היום: "מושבתת"). is_active אינו משתנה.
-- סנכרון דו-כיווני ב-trigger: קוד חדש כותב status (is_active נגזר); קוד ישן שכותב is_active מעדכן את status.
-- שחזור: Revert הקוד (is_active נשאר מעודכן ותקין). הסרה מלאה (לא מורץ): DROP TRIGGER nurseries_status_sync ON "nurseries";
--   DROP FUNCTION nursery_status_sync(); ALTER TABLE "nurseries" DROP COLUMN "status"; DROP TYPE "NurseryStatus".

-- CreateEnum
CREATE TYPE "NurseryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "nurseries" ADD COLUMN     "status" "NurseryStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "nurseries" SET "status" = 'SUSPENDED' WHERE "is_active" = false;

CREATE FUNCTION nursery_status_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- הכנסה עם is_active=false בלי סטטוס מפורש (קוד ישן) → מושעית
    IF NEW."is_active" = false AND NEW."status" = 'ACTIVE' THEN NEW."status" := 'SUSPENDED'; END IF;
  ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
    NULL; -- status שונה — הוא הקובע
  ELSIF NEW."is_active" IS DISTINCT FROM OLD."is_active" THEN
    NEW."status" := CASE WHEN NEW."is_active" THEN 'ACTIVE'::"NurseryStatus" ELSE 'SUSPENDED'::"NurseryStatus" END;
  END IF;
  NEW."is_active" := (NEW."status" = 'ACTIVE');
  RETURN NEW;
END $$;

CREATE TRIGGER nurseries_status_sync
BEFORE INSERT OR UPDATE ON "nurseries"
FOR EACH ROW EXECUTE FUNCTION nursery_status_sync();

-- אימות: כל שורה עקבית
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "nurseries" WHERE "is_active" <> ("status" = 'ACTIVE')) THEN
    RAISE EXCEPTION 'nursery status backfill is inconsistent';
  END IF;
END $$;
