-- איסוף עצמי / משלוח (פריטים חדשים בלבד — אין שינוי לנתונים קיימים)
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

ALTER TABLE "orders" ADD COLUMN "delivery_method" "DeliveryMethod";

ALTER TABLE "nurseries"
  ADD COLUMN "pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "delivery_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "delivery_note" TEXT;

-- מוצרי דפוס: שדות מורחבים לעריכה ויצירה
ALTER TABLE "print_products"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "specs" TEXT,
  ADD COLUMN "unit_label" TEXT,
  ADD COLUMN "lead_time_days" INTEGER,
  ADD COLUMN "price_tiers" JSONB,
  ADD COLUMN "requires_artwork" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allow_options" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "print_order_items" ADD COLUMN "options" JSONB;
