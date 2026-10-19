-- PT-02/03/07 (נספח א): תבניות דפוס בגרסאות בלתי משתנות — Expand בלבד.
-- טבלאות print_templates / print_template_versions; פריט הזמנת דפוס יכול להיות מתבנית (Snapshot: גרסה,
-- שם, ערכים שנבדקו בשרת, פירוט מחיר) או ממוצר ישן; סטטוס QUOTE_REQUESTED להזמנת "הצעת מחיר בלבד".
-- trigger מונע שינוי של גרסה שפורסמה; גרסה שהוזמנה אינה נמחקת (FK). ההזמנות והמוצרים הקיימים לא משתנים.
-- שחזור: Revert הקוד — המוצרים הישנים ממשיכים לעבוד. הסרה מלאה (לא מורץ): DROP TRIGGER/FUNCTION,
--   ALTER TABLE print_order_items DROP CONSTRAINT print_order_items_source_check, DROP COLUMN (4 עמודות),
--   SET NOT NULL על print_product_id (רק אם אין פריטים מתבנית), DROP TABLE print_template_versions, print_templates.

-- CreateEnum
CREATE TYPE "PrintTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "PrintOrderStatus" ADD VALUE 'QUOTE_REQUESTED';

-- AlterTable
ALTER TABLE "print_order_items" ADD COLUMN     "price_breakdown" JSONB,
ADD COLUMN     "template_version_id" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "values" JSONB,
ALTER COLUMN "print_product_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "print_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "image_url" TEXT,
    "unit_label" TEXT,
    "lead_time_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PrintTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "fields" JSONB NOT NULL,
    "pricing" JSONB NOT NULL,
    "notes" TEXT,
    "created_by" TEXT,
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "print_template_versions_template_id_version_key" ON "print_template_versions"("template_id", "version");

-- AddForeignKey
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "print_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_template_versions" ADD CONSTRAINT "print_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "print_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- גרסה אחת לכל היותר בטיוטה, ואחת לכל היותר מפורסמת (הפעילה), לכל תבנית
CREATE UNIQUE INDEX "print_template_versions_one_draft" ON "print_template_versions"("template_id") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "print_template_versions_one_published" ON "print_template_versions"("template_id") WHERE "status" = 'PUBLISHED';

-- פריט הזמנה הוא או מוצר ישן או גרסת תבנית — לא שניהם ולא אף אחד
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_source_check"
  CHECK (("print_product_id" IS NOT NULL) <> ("template_version_id" IS NOT NULL));

-- PT-02: גרסה שאינה טיוטה אינה משתנה — מותר רק מעבר PUBLISHED → ARCHIVED.
-- מחיקה: גרסה שהוזמנה מוגנת ב-FK (ON DELETE RESTRICT מפריטי הזמנה); גרסה שלא הוזמנה מעולם — מותר למחוק.
CREATE FUNCTION print_template_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN
    IF NEW."fields" IS DISTINCT FROM OLD."fields" OR NEW."pricing" IS DISTINCT FROM OLD."pricing"
       OR NEW."version" <> OLD."version" OR NEW."template_id" <> OLD."template_id"
       OR NEW."published_at" IS DISTINCT FROM OLD."published_at" OR NEW."published_by" IS DISTINCT FROM OLD."published_by"
       OR NOT (NEW."status" = OLD."status" OR (OLD."status" = 'PUBLISHED' AND NEW."status" = 'ARCHIVED')) THEN
      RAISE EXCEPTION 'print template version % is % and immutable', OLD."id", OLD."status";
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER print_template_versions_immutable
BEFORE UPDATE ON "print_template_versions"
FOR EACH ROW EXECUTE FUNCTION print_template_version_immutable();

ALTER TABLE "print_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_template_versions" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "print_templates" FROM anon, authenticated;
    REVOKE ALL ON TABLE "print_template_versions" FROM anon, authenticated;
  END IF;
END $$;
