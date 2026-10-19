-- PT-09 (חלקי, נספח א.5/א.8): פרופיל ייצור בגרסת תבנית ותוצאת בדיקת קובץ בסיסית — Expand בלבד.
-- production: נעול יחד עם שאר הגרסה אחרי פרסום (עדכון פונקציית ה-trigger הקיימת).
-- preflight: נקבע פעם אחת בעת רישום הקובץ ואינו משתנה אחר כך.
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TRIGGER print_files_preflight_immutable + FUNCTION,
--   DROP COLUMN print_template_versions.production, print_files.preflight, והחזרת גרסת הפונקציה
--   print_template_version_immutable מ-20261019070000_print_templates.

-- AlterTable
ALTER TABLE "print_files" ADD COLUMN     "preflight" JSONB;

-- AlterTable
ALTER TABLE "print_template_versions" ADD COLUMN     "production" JSONB;

CREATE OR REPLACE FUNCTION print_template_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN
    IF NEW."fields" IS DISTINCT FROM OLD."fields" OR NEW."pricing" IS DISTINCT FROM OLD."pricing"
       OR NEW."production" IS DISTINCT FROM OLD."production"
       OR NEW."version" <> OLD."version" OR NEW."template_id" <> OLD."template_id"
       OR NEW."published_at" IS DISTINCT FROM OLD."published_at" OR NEW."published_by" IS DISTINCT FROM OLD."published_by"
       OR NOT (NEW."status" = OLD."status" OR (OLD."status" = 'PUBLISHED' AND NEW."status" = 'ARCHIVED')) THEN
      RAISE EXCEPTION 'print template version % is % and immutable', OLD."id", OLD."status";
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION print_file_preflight_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."preflight" IS NOT NULL AND NEW."preflight" IS DISTINCT FROM OLD."preflight" THEN
    RAISE EXCEPTION 'preflight of print file % is immutable', OLD."id";
  END IF;
  IF NEW."sha256" <> OLD."sha256" OR NEW."storage_key" <> OLD."storage_key" OR NEW."size_bytes" <> OLD."size_bytes" THEN
    RAISE EXCEPTION 'print file % content is immutable', OLD."id";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER print_files_preflight_immutable
BEFORE UPDATE ON "print_files"
FOR EACH ROW EXECUTE FUNCTION print_file_preflight_immutable();
