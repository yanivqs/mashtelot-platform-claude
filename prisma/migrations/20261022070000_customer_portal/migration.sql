-- R06-04 / §13.02-03: אזור אישי ללקוח — ספר כתובות ומועדפים. Expand בלבד.
-- מועדף רק למוצר של המשתלה של הלקוח (trigger).
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TRIGGER customer_favorites_same_nursery ON "customer_favorites";
--   DROP FUNCTION customer_favorite_same_nursery(); DROP TABLE "customer_favorites"; DROP TABLE "customer_addresses".

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "label" TEXT,
    "city" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "postcode" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_favorites" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "nursery_product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_favorites_customer_id_nursery_product_id_key" ON "customer_favorites"("customer_id", "nursery_product_id");

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_favorites" ADD CONSTRAINT "customer_favorites_nursery_product_id_fkey" FOREIGN KEY ("nursery_product_id") REFERENCES "nursery_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE FUNCTION customer_favorite_same_nursery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "customers" c JOIN "nursery_products" p ON p."nursery_id" = c."nursery_id"
    WHERE c."id" = NEW."customer_id" AND p."id" = NEW."nursery_product_id"
  ) THEN
    RAISE EXCEPTION 'favorite must be a product of the customer''s nursery';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER customer_favorites_same_nursery
BEFORE INSERT OR UPDATE ON "customer_favorites"
FOR EACH ROW EXECUTE FUNCTION customer_favorite_same_nursery();

ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_favorites" ENABLE ROW LEVEL SECURITY;
