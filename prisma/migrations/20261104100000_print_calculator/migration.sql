-- מחשבון דפוס, בדיקת צוות ו"העבודות שלי" — Expand בלבד.
-- print_templates: כתובת (slug) וגלריה. התבניות הקיימות מקבלות slug מהמזהה.
-- print_orders: סימון "צריך עיצוב", סיבות לבדיקה, מחזור הצעת מחיר, הערות פנימיות.
-- print_order_items.unit_price: 4 ספרות אחרי הנקודה (מחיר ליחידה יכול להיות 0.748).
-- print_file_thumbnails: תמונה קטנה של קובץ, בטבלה נפרדת כדי שלא תיטען בכל שאילתה על קבצים.
-- שחזור: Revert הקוד — העמודות החדשות אינן חובה. הסרה מלאה (לא מורץ): DROP TABLE print_file_thumbnails,
--   DROP COLUMN לעמודות החדשות, DROP TYPE "PrintQuoteStatus". הרחבת unit_price אינה דורשת שחזור.

-- CreateEnum
CREATE TYPE "PrintQuoteStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'SENT', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "print_templates"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "gallery_images" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "print_templates" SET "slug" = 'product-' || left("id", 8) WHERE "slug" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "print_templates_slug_key" ON "print_templates"("slug");

-- AlterTable
ALTER TABLE "print_orders"
  ADD COLUMN "needs_design" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "review_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "quote_status" "PrintQuoteStatus",
  ADD COLUMN "quote_valid_until" TIMESTAMP(3),
  ADD COLUMN "admin_notes" TEXT;

-- AlterTable
ALTER TABLE "print_order_items" ALTER COLUMN "unit_price" TYPE DECIMAL(10,4);

-- CreateTable
CREATE TABLE "print_file_thumbnails" (
    "file_id" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_file_thumbnails_pkey" PRIMARY KEY ("file_id")
);

-- AddForeignKey
ALTER TABLE "print_file_thumbnails" ADD CONSTRAINT "print_file_thumbnails_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "print_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "print_file_thumbnails" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "print_file_thumbnails" FROM anon, authenticated;
  END IF;
END $$;
