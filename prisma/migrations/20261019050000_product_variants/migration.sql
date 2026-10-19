-- §7.01 / §8.01 / §9.01 / R02-03: וריאנטים — Expand בלבד (אין מחיקה של עמודות קיימות).
-- 1. טבלת product_variants + עמודות חדשות ב-order_items / stock_movements / nursery_products.
-- 2. Backfill: לכל מוצר וריאנט ברירת מחדל עם המלאי והשמור הנוכחיים; מחיר ריק = יורש מהמוצר.
-- 3. Triggers: (א) מוצר חדש מקבל וריאנט ברירת מחדל; (ב) מלאי המוצר = סכום הווריאנטים הפעילים
--    (כתיבה כפולה ברמת ה-DB — חזרה לקוד הקודם רואה מלאי נכון).
-- 4. אימות: סכומי מלאי/שמור לכל מוצר זהים לפני ואחרי, וריאנט ברירת מחדל אחד בדיוק לכל מוצר,
--    וכל שורת הזמנה/תנועה שויכה — אחרת RAISE והמיגרציה כולה מתבטלת (טרנזקציה אחת).
-- שחזור: (1) Revert הקוד — העמודות הישנות עדכניות בזכות ה-trigger. (2) הסרה מלאה (לא מורץ):
--   DROP TRIGGER nursery_products_default_variant ON nursery_products;
--   DROP TRIGGER product_variants_sync_stock ON product_variants;
--   DROP FUNCTION create_default_product_variant(); DROP FUNCTION sync_product_stock_from_variants();
--   ALTER TABLE order_items DROP COLUMN variant_id, DROP COLUMN variant_name;
--   ALTER TABLE stock_movements DROP COLUMN variant_id; ALTER TABLE nursery_products DROP COLUMN option_label;
--   DROP TABLE product_variants;

-- AlterTable
ALTER TABLE "nursery_products" ADD COLUMN     "option_label" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variant_id" TEXT,
ADD COLUMN     "variant_name" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "variant_id" TEXT;

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "nursery_product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "sku" TEXT,
    "barcode" TEXT,
    "price" DECIMAL(10,2),
    "compare_at_price" DECIMAL(10,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_variants_nursery_product_id_idx" ON "product_variants"("nursery_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_nursery_id_sku_key" ON "product_variants"("nursery_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_nursery_id_barcode_key" ON "product_variants"("nursery_id", "barcode");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_nursery_product_id_fkey" FOREIGN KEY ("nursery_product_id") REFERENCES "nursery_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- וריאנט ברירת מחדל אחד בדיוק לכל מוצר (אינדקס חלקי — Prisma אינו מייצג אותו בסכמה)
CREATE UNIQUE INDEX "product_variants_one_default_per_product" ON "product_variants"("nursery_product_id") WHERE "is_default";

ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "product_variants" FROM anon, authenticated;
  END IF;
END $$;

-- Backfill
INSERT INTO "product_variants" ("id", "nursery_id", "nursery_product_id", "name", "stock_quantity", "reserved_quantity", "is_default", "is_active", "sort_order", "updated_at")
SELECT gen_random_uuid()::text, "nursery_id", "id", '', "stock_quantity", "reserved_quantity", true, true, 0, CURRENT_TIMESTAMP
FROM "nursery_products";

UPDATE "order_items" oi SET "variant_id" = v."id"
FROM "product_variants" v
WHERE v."nursery_product_id" = oi."nursery_product_id" AND v."is_default";

UPDATE "stock_movements" sm SET "variant_id" = v."id"
FROM "product_variants" v
WHERE v."nursery_product_id" = sm."nursery_product_id" AND v."is_default";

-- Trigger א: מוצר חדש → וריאנט ברירת מחדל
CREATE FUNCTION create_default_product_variant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "product_variants" ("id", "nursery_id", "nursery_product_id", "name", "stock_quantity", "reserved_quantity", "is_default", "is_active", "sort_order", "updated_at")
  VALUES (gen_random_uuid()::text, NEW."nursery_id", NEW."id", '', NEW."stock_quantity", NEW."reserved_quantity", true, true, 0, CURRENT_TIMESTAMP);
  RETURN NULL;
END $$;

CREATE TRIGGER nursery_products_default_variant
AFTER INSERT ON "nursery_products"
FOR EACH ROW EXECUTE FUNCTION create_default_product_variant();

-- Trigger ב: מלאי המוצר = סכום הווריאנטים הפעילים
CREATE FUNCTION sync_product_stock_from_variants() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pid text;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD."nursery_product_id"; ELSE pid := NEW."nursery_product_id"; END IF;
  UPDATE "nursery_products" p SET
    "stock_quantity" = COALESCE((SELECT sum(v."stock_quantity") FROM "product_variants" v WHERE v."nursery_product_id" = pid AND v."is_active"), 0),
    "reserved_quantity" = COALESCE((SELECT sum(v."reserved_quantity") FROM "product_variants" v WHERE v."nursery_product_id" = pid AND v."is_active"), 0)
  WHERE p."id" = pid;
  RETURN NULL;
END $$;

CREATE TRIGGER product_variants_sync_stock
AFTER INSERT OR DELETE OR UPDATE OF "stock_quantity", "reserved_quantity", "is_active" ON "product_variants"
FOR EACH ROW EXECUTE FUNCTION sync_product_stock_from_variants();

-- אימות
DO $$
DECLARE bad_products int; bad_items int; bad_moves int;
BEGIN
  SELECT count(*) INTO bad_products
  FROM "nursery_products" p
  LEFT JOIN (
    SELECT "nursery_product_id", sum("stock_quantity") s, sum("reserved_quantity") r, count(*) FILTER (WHERE "is_default") d
    FROM "product_variants" GROUP BY 1
  ) v ON v."nursery_product_id" = p."id"
  WHERE v.s IS DISTINCT FROM p."stock_quantity" OR v.r IS DISTINCT FROM p."reserved_quantity" OR v.d IS DISTINCT FROM 1;
  SELECT count(*) INTO bad_items FROM "order_items" WHERE "variant_id" IS NULL;
  SELECT count(*) INTO bad_moves FROM "stock_movements" WHERE "variant_id" IS NULL;
  IF bad_products > 0 OR bad_items > 0 OR bad_moves > 0 THEN
    RAISE EXCEPTION 'variants backfill verification failed: products=%, order_items=%, stock_movements=%', bad_products, bad_items, bad_moves;
  END IF;
END $$;
