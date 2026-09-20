-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shipping_cost" DECIMAL(10,2),
ADD COLUMN     "shipping_zone_id" TEXT;

-- CreateTable
CREATE TABLE "shipping_zones" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "shipping_price" DECIMAL(10,2) NOT NULL,
    "free_shipping_threshold" DECIMAL(10,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_zone_cities" (
    "id" TEXT NOT NULL,
    "shipping_zone_id" TEXT NOT NULL,
    "city_name" TEXT NOT NULL,
    "normalized_city_name" TEXT NOT NULL,

    CONSTRAINT "shipping_zone_cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_zone_cities_shipping_zone_id_normalized_city_name_key" ON "shipping_zone_cities"("shipping_zone_id", "normalized_city_name");

-- AddForeignKey
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_zone_cities" ADD CONSTRAINT "shipping_zone_cities_shipping_zone_id_fkey" FOREIGN KEY ("shipping_zone_id") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_zone_id_fkey" FOREIGN KEY ("shipping_zone_id") REFERENCES "shipping_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

