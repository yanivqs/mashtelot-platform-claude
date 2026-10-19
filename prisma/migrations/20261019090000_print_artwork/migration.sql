-- PT-05 / PT-08 (נספח א.7–א.10): קבצי דפוס פרטיים, גרסאות גרפיקה, הגהה ואישור מפורש — Expand בלבד.
-- גרסת גרפיקה נעולה (הקובץ והמספר לא משתנים); מעברים: UPLOADED → PROOF_SENT → APPROVED/REJECTED,
-- וכל גרסה לא סופית → SUPERSEDED כשמועלית גרסה חדשה. אישור מתייחס לגרסה ספציפית ומתועד (מי, מתי, איך).
-- גרפיקה שייכת למוצר קבוע או להזמנה — בדיוק אחד מהם.
-- תיקון (שלב ב): print_order_items.saved_revision_id, וגם קובץ↔גרסת גרפיקה — NO ACTION + DEFERRABLE INITIALLY DEFERRED:
--   נבדקים בסוף הטרנזקציה. RESTRICT (ואף NO ACTION רגיל) נבדקים בתוך כל ענף של מחיקה מדורגת ושברו מחיקת משתלה;
--   מחיקה ישירה של קובץ/גרסת מפרט שבשימוש עדיין נחסמת (בסוף הטרנזקציה).
-- שחזור: Revert הקוד — אין שימוש בטבלאות. הסרה מלאה (לא מורץ): DROP TRIGGER/FUNCTION, DROP TABLE print_artwork_versions,
--   print_artworks, print_files, DROP TYPE "PrintArtworkStatus", "PrintApprovalMethod", "PrintFileKind". קבצי האחסון — מחיקה ידנית.

-- CreateEnum
CREATE TYPE "PrintFileKind" AS ENUM ('ARTWORK', 'PROOF', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "PrintArtworkStatus" AS ENUM ('UPLOADED', 'PROOF_SENT', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PrintApprovalMethod" AS ENUM ('OWNER', 'PHONE');

-- DropForeignKey
ALTER TABLE "print_order_items" DROP CONSTRAINT "print_order_items_saved_revision_id_fkey";

-- CreateTable
CREATE TABLE "print_files" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "kind" "PrintFileKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_artworks" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "saved_product_id" TEXT,
    "print_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_artworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_artwork_versions" (
    "id" TEXT NOT NULL,
    "artwork_id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "file_id" TEXT NOT NULL,
    "status" "PrintArtworkStatus" NOT NULL DEFAULT 'UPLOADED',
    "proof_file_id" TEXT,
    "proof_sent_at" TIMESTAMP(3),
    "proof_sent_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approval_method" "PrintApprovalMethod",
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "print_artwork_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "print_files_storage_key_key" ON "print_files"("storage_key");

-- CreateIndex
CREATE INDEX "print_files_nursery_id_idx" ON "print_files"("nursery_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_artworks_saved_product_id_key" ON "print_artworks"("saved_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_artworks_print_order_id_key" ON "print_artworks"("print_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_artwork_versions_artwork_id_version_key" ON "print_artwork_versions"("artwork_id", "version");

-- AddForeignKey
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_saved_revision_id_fkey" FOREIGN KEY ("saved_revision_id") REFERENCES "print_saved_revisions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_files" ADD CONSTRAINT "print_files_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_artworks" ADD CONSTRAINT "print_artworks_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_artworks" ADD CONSTRAINT "print_artworks_saved_product_id_fkey" FOREIGN KEY ("saved_product_id") REFERENCES "print_saved_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_artworks" ADD CONSTRAINT "print_artworks_print_order_id_fkey" FOREIGN KEY ("print_order_id") REFERENCES "print_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_artwork_versions" ADD CONSTRAINT "print_artwork_versions_artwork_id_fkey" FOREIGN KEY ("artwork_id") REFERENCES "print_artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_artwork_versions" ADD CONSTRAINT "print_artwork_versions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "print_files"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_artwork_versions" ADD CONSTRAINT "print_artwork_versions_proof_file_id_fkey" FOREIGN KEY ("proof_file_id") REFERENCES "print_files"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


ALTER TABLE "print_order_items" ALTER CONSTRAINT "print_order_items_saved_revision_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "print_artwork_versions" ALTER CONSTRAINT "print_artwork_versions_file_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "print_artwork_versions" ALTER CONSTRAINT "print_artwork_versions_proof_file_id_fkey" DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "print_artworks" ADD CONSTRAINT "print_artworks_subject_check"
  CHECK (("saved_product_id" IS NOT NULL) <> ("print_order_id" IS NOT NULL));

CREATE FUNCTION print_artwork_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."file_id" <> OLD."file_id" OR NEW."version" <> OLD."version" OR NEW."artwork_id" <> OLD."artwork_id"
     OR NEW."nursery_id" <> OLD."nursery_id" THEN
    RAISE EXCEPTION 'print artwork version % is immutable', OLD."id";
  END IF;
  IF OLD."status" IN ('APPROVED', 'REJECTED', 'SUPERSEDED') AND NEW."status" <> OLD."status" THEN
    IF NOT (OLD."status" = 'APPROVED' AND NEW."status" = 'SUPERSEDED') THEN
      RAISE EXCEPTION 'invalid artwork status transition % -> %', OLD."status", NEW."status";
    END IF;
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
       (OLD."status" = 'UPLOADED' AND NEW."status" IN ('PROOF_SENT', 'SUPERSEDED'))
    OR (OLD."status" = 'PROOF_SENT' AND NEW."status" IN ('APPROVED', 'REJECTED', 'SUPERSEDED'))
    OR (OLD."status" = 'APPROVED' AND NEW."status" = 'SUPERSEDED')) THEN
    RAISE EXCEPTION 'invalid artwork status transition % -> %', OLD."status", NEW."status";
  END IF;
  -- אישור/החלטה שנרשמו אינם משתנים
  IF OLD."approved_at" IS NOT NULL AND (NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
     OR NEW."approved_by" IS DISTINCT FROM OLD."approved_by" OR NEW."approval_method" IS DISTINCT FROM OLD."approval_method") THEN
    RAISE EXCEPTION 'artwork approval of % is immutable', OLD."id";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER print_artwork_versions_guard
BEFORE UPDATE ON "print_artwork_versions"
FOR EACH ROW EXECUTE FUNCTION print_artwork_version_guard();

ALTER TABLE "print_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_artworks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_artwork_versions" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "print_files" FROM anon, authenticated;
    REVOKE ALL ON TABLE "print_artworks" FROM anon, authenticated;
    REVOKE ALL ON TABLE "print_artwork_versions" FROM anon, authenticated;
  END IF;
END $$;
