-- PT-04 (נספח א.6–א.7): מוצר דפוס קבוע לכל משתלה + גרסאות מפרט נעולות — Expand בלבד.
-- גרסת מפרט היא צילום (גרסת תבנית + ערכים) שאינו משתנה; רק מעברי סטטוס מותרים:
-- SUBMITTED → APPROVED/REJECTED, APPROVED → SUPERSEDED. בקשה ממתינה אחת לכל מוצר קבוע.
-- שחזור: Revert הקוד — אין שימוש בטבלאות. הסרה מלאה (לא מורץ): DROP TRIGGER/FUNCTION,
--   ALTER TABLE print_order_items DROP COLUMN saved_revision_id, DROP TABLE print_saved_revisions, print_saved_products, DROP TYPE "PrintSpecStatus".

-- CreateEnum
CREATE TYPE "PrintSpecStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "print_order_items" ADD COLUMN     "saved_revision_id" TEXT;

-- CreateTable
CREATE TABLE "print_saved_products" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "active_revision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_saved_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_saved_revisions" (
    "id" TEXT NOT NULL,
    "saved_product_id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "status" "PrintSpecStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,

    CONSTRAINT "print_saved_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "print_saved_products_active_revision_id_key" ON "print_saved_products"("active_revision_id");

-- CreateIndex
CREATE INDEX "print_saved_products_nursery_id_idx" ON "print_saved_products"("nursery_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_saved_revisions_saved_product_id_revision_key" ON "print_saved_revisions"("saved_product_id", "revision");

-- AddForeignKey
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_saved_revision_id_fkey" FOREIGN KEY ("saved_revision_id") REFERENCES "print_saved_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_saved_products" ADD CONSTRAINT "print_saved_products_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_saved_products" ADD CONSTRAINT "print_saved_products_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "print_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_saved_products" ADD CONSTRAINT "print_saved_products_active_revision_id_fkey" FOREIGN KEY ("active_revision_id") REFERENCES "print_saved_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_saved_revisions" ADD CONSTRAINT "print_saved_revisions_saved_product_id_fkey" FOREIGN KEY ("saved_product_id") REFERENCES "print_saved_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_saved_revisions" ADD CONSTRAINT "print_saved_revisions_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "print_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


CREATE UNIQUE INDEX "print_saved_revisions_one_pending" ON "print_saved_revisions"("saved_product_id") WHERE "status" = 'SUBMITTED';

CREATE FUNCTION print_saved_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."values" IS DISTINCT FROM OLD."values" OR NEW."template_version_id" <> OLD."template_version_id"
     OR NEW."revision" <> OLD."revision" OR NEW."saved_product_id" <> OLD."saved_product_id"
     OR NEW."nursery_id" <> OLD."nursery_id" OR NEW."submitted_at" <> OLD."submitted_at"
     OR NEW."submitted_by" IS DISTINCT FROM OLD."submitted_by" THEN
    RAISE EXCEPTION 'print saved revision % is immutable', OLD."id";
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('APPROVED', 'REJECTED'))
    OR (OLD."status" = 'APPROVED' AND NEW."status" = 'SUPERSEDED')) THEN
    RAISE EXCEPTION 'invalid spec status transition % -> %', OLD."status", NEW."status";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER print_saved_revisions_immutable
BEFORE UPDATE ON "print_saved_revisions"
FOR EACH ROW EXECUTE FUNCTION print_saved_revision_immutable();

ALTER TABLE "print_saved_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_saved_revisions" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "print_saved_products" FROM anon, authenticated;
    REVOKE ALL ON TABLE "print_saved_revisions" FROM anon, authenticated;
  END IF;
END $$;
