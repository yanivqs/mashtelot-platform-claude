-- C-P1-02 (Expand): סטטוסי R05-07, סטטוס תשלום, שמירת מלאי עם פקיעה, Idempotency, Snapshot הנחה,
-- תנועות מלאי (§8.02), מגבלות קופון (§12.01). תוספות בלבד — ערכי הסטטוס הישנים נשמרים.
-- ערכי enum חדשים אינם בשימוש במיגרציה זו (מגבלת PostgreSQL); ההמרה ב-20261018000100.

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StockState" AS ENUM ('NONE', 'RESERVED', 'RELEASED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('RESERVE', 'RELEASE_EXPIRED', 'RELEASE_CANCELLED', 'COMMIT', 'RESTORE_CANCELLED', 'MANUAL_ADJUST');

-- AlterEnum


ALTER TYPE "OrderStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'PREPARING';
ALTER TYPE "OrderStatus" ADD VALUE 'READY';

-- AlterTable
ALTER TABLE "nursery_products" ADD COLUMN     "reserved_quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "coupon_code" TEXT,
ADD COLUMN     "coupon_id" TEXT,
ADD COLUMN     "discount_amount" DECIMAL(10,2),
ADD COLUMN     "discount_pct" DECIMAL(5,2),
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "reservation_expires_at" TIMESTAMP(3),
ADD COLUMN     "stock_state" "StockState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "subtotal_amount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "min_order_amount" DECIMAL(10,2),
ADD COLUMN     "per_customer_limit" INTEGER;

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "nursery_product_id" TEXT NOT NULL,
    "order_id" TEXT,
    "reason" "StockMovementReason" NOT NULL,
    "on_hand_delta" INTEGER NOT NULL DEFAULT 0,
    "reserved_delta" INTEGER NOT NULL DEFAULT 0,
    "actor_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_nursery_id_created_at_idx" ON "stock_movements"("nursery_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_nursery_product_id_created_at_idx" ON "stock_movements"("nursery_product_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_stock_state_reservation_expires_at_idx" ON "orders"("stock_state", "reservation_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_nursery_id_idempotency_key_key" ON "orders"("nursery_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_nursery_product_id_fkey" FOREIGN KEY ("nursery_product_id") REFERENCES "nursery_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS לטבלה החדשה (C-P0-02: אין טבלה ב-public בלי RLS)
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
