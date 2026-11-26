-- שלטי צמחים 15×10 ס"מ: מוצר דפוס מיוחד. המשתלה בוחרת צמחים, עורכת את השלט ומזמינה; בית הדפוס מפיק PDF.
-- תוספות בלבד: עמודה לעריכות השלט במוצר, סוג למוצר הדפוס, וטבלה ל-Snapshot של השלטים בהזמנה.

ALTER TABLE "nursery_products" ADD COLUMN "sign_settings" JSONB;

ALTER TABLE "print_templates" ADD COLUMN "kind" TEXT;

CREATE TABLE "print_plant_signs" (
    "id" TEXT NOT NULL,
    "print_order_id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "nursery_product_id" TEXT,
    "quantity" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_plant_signs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "print_plant_signs_print_order_id_idx" ON "print_plant_signs"("print_order_id");

ALTER TABLE "print_plant_signs" ADD CONSTRAINT "print_plant_signs_print_order_id_fkey" FOREIGN KEY ("print_order_id") REFERENCES "print_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "print_plant_signs" ADD CONSTRAINT "print_plant_signs_nursery_product_id_fkey" FOREIGN KEY ("nursery_product_id") REFERENCES "nursery_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- C-P0-02: כמו כל טבלה — RLS פעיל, בלי מדיניות (הגישה רק דרך השרת)
ALTER TABLE "print_plant_signs" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "print_plant_signs" FROM anon, authenticated;
  END IF;
END $$;
