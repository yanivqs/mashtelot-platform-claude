-- עבודות דפוס קודמות שהסופר-אדמין מוסיף למשתלה: עבודה יכולה להיות בלי מוצר מהקטלוג, והיסטוריית ההזמנות שלה נרשמת ידנית.
-- Expand בלבד. שחזור: לפני Revert של הקוד יש למחוק עבודות בלי template_id, כי קוד ישן מניח שיש מוצר.
--   הסרה מלאה (לא מורץ): DROP COLUMN print_saved_products.description, imported_at, imported_by,
--   print_orders.imported, print_order_items.saved_product_id; SET NOT NULL על template_id; החזרת print_order_items_source_check הקודם.

-- AlterTable
ALTER TABLE "print_saved_products"
  ALTER COLUMN "template_id" DROP NOT NULL,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "imported_at" TIMESTAMP(3),
  ADD COLUMN "imported_by" TEXT;

-- AlterTable
ALTER TABLE "print_orders" ADD COLUMN "imported" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "print_order_items" ADD COLUMN "saved_product_id" TEXT;

-- CreateIndex
CREATE INDEX "print_order_items_saved_product_id_idx" ON "print_order_items"("saved_product_id");

-- AddForeignKey
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_saved_product_id_fkey" FOREIGN KEY ("saved_product_id") REFERENCES "print_saved_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- לכל פריט מקור אחד בדיוק: מוצר ישן, גרסת תבנית, או עבודה קודמת
ALTER TABLE "print_order_items" DROP CONSTRAINT "print_order_items_source_check";
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_source_check"
  CHECK (num_nonnulls("print_product_id", "template_version_id", "saved_product_id") = 1);
