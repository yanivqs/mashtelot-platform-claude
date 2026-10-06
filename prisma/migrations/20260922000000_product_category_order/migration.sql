-- AlterTable
ALTER TABLE "nursery_product_categories" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "nursery_product_categories_nursery_category_id_sort_order_idx" ON "nursery_product_categories"("nursery_category_id", "sort_order");

