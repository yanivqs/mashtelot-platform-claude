-- §11.01: אזורי משלוח לפי מיקוד (בנוסף לעיר) — Expand בלבד. אזורים קיימים ממשיכים לעבוד לפי עיר בלבד.
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TABLE "shipping_zone_postcodes"; ALTER TABLE "orders" DROP COLUMN "shipping_postcode".

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shipping_postcode" TEXT;

-- CreateTable
CREATE TABLE "shipping_zone_postcodes" (
    "id" TEXT NOT NULL,
    "shipping_zone_id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,

    CONSTRAINT "shipping_zone_postcodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_zone_postcodes_shipping_zone_id_prefix_key" ON "shipping_zone_postcodes"("shipping_zone_id", "prefix");

-- AddForeignKey
ALTER TABLE "shipping_zone_postcodes" ADD CONSTRAINT "shipping_zone_postcodes_shipping_zone_id_fkey" FOREIGN KEY ("shipping_zone_id") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- מיקוד או התחלה של מיקוד: 1–7 ספרות
ALTER TABLE "shipping_zone_postcodes" ADD CONSTRAINT "shipping_zone_postcodes_prefix_check" CHECK ("prefix" ~ '^[0-9]{1,7}$');

ALTER TABLE "shipping_zone_postcodes" ENABLE ROW LEVEL SECURITY;
