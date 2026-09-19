-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BIT', 'PAYBOX', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "starts_at" TIMESTAMP(3),
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usage_limit" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_method" "PaymentMethod",
ADD COLUMN     "payment_reference" TEXT;

-- CreateTable
CREATE TABLE "nursery_payment_methods" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "destination" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursery_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nursery_payment_methods_nursery_id_method_key" ON "nursery_payment_methods"("nursery_id", "method");

-- AddForeignKey
ALTER TABLE "nursery_payment_methods" ADD CONSTRAINT "nursery_payment_methods_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
