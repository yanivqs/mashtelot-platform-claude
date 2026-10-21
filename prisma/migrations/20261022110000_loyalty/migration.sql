-- R06-06/07: מועדון נקודות (Ledger) והנחת קבוצת לקוחות — Expand בלבד. אין שינוי בהזמנות קיימות.
-- היומן אינו ניתן לעריכה (trigger): מותר רק ניתוק הזמנה שנמחקה (order_id → NULL). שורות נמחקות רק עם הלקוח/המשתלה.
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TRIGGER/FUNCTION loyalty_entry_guard; DROP TABLE "loyalty_entries",
--   "loyalty_settings"; DROP TYPE "LoyaltyKind"; ALTER TABLE "orders" DROP COLUMN "group_discount_pct",
--   "group_discount_amount", "loyalty_points_used", "loyalty_discount"; ALTER TABLE "customer_groups" DROP COLUMN "discount_pct".

-- CreateEnum
CREATE TYPE "LoyaltyKind" AS ENUM ('EARN', 'REDEEM', 'REVERSE_EARN', 'REFUND_REDEEM', 'ADJUST');

-- AlterTable
ALTER TABLE "customer_groups" ADD COLUMN     "discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "group_discount_amount" DECIMAL(10,2),
ADD COLUMN     "group_discount_pct" DECIMAL(5,2),
ADD COLUMN     "loyalty_discount" DECIMAL(10,2),
ADD COLUMN     "loyalty_points_used" INTEGER;

-- CreateTable
CREATE TABLE "loyalty_settings" (
    "nursery_id" TEXT NOT NULL,
    "points_per_shekel" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "point_value" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "max_redeem_pct" INTEGER NOT NULL DEFAULT 50,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("nursery_id")
);

-- CreateTable
CREATE TABLE "loyalty_entries" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "kind" "LoyaltyKind" NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "actor_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loyalty_entries_customer_id_idx" ON "loyalty_entries"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_entries_order_id_kind_key" ON "loyalty_entries"("order_id", "kind");

-- AddForeignKey
ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_discount_range" CHECK ("discount_pct" >= 0 AND "discount_pct" <= 50);
ALTER TABLE "loyalty_settings" ADD CONSTRAINT "loyalty_settings_ranges" CHECK (
  "points_per_shekel" >= 0 AND "points_per_shekel" <= 100 AND "point_value" >= 0 AND "point_value" <= 100
  AND "max_redeem_pct" BETWEEN 0 AND 100);
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_points_nonzero" CHECK ("points" <> 0);

CREATE FUNCTION loyalty_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- רק ניתוק הזמנה שנמחקה; כל שינוי אחר אסור
    IF NEW."order_id" IS NULL AND OLD."order_id" IS NOT NULL
       AND (NEW."id", NEW."nursery_id", NEW."customer_id", NEW."kind", NEW."points", NEW."note", NEW."actor_email", NEW."created_at")
           IS NOT DISTINCT FROM (OLD."id", OLD."nursery_id", OLD."customer_id", OLD."kind", OLD."points", OLD."note", OLD."actor_email", OLD."created_at") THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'loyalty entry % is immutable', OLD."id";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "customers" c WHERE c."id" = NEW."customer_id" AND c."nursery_id" = NEW."nursery_id") THEN
    RAISE EXCEPTION 'loyalty entry customer must belong to the nursery';
  END IF;
  IF NEW."order_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "orders" o WHERE o."id" = NEW."order_id" AND o."nursery_id" = NEW."nursery_id" AND o."customer_id" = NEW."customer_id"
  ) THEN
    RAISE EXCEPTION 'loyalty entry order must belong to the customer';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER loyalty_entries_guard
BEFORE INSERT OR UPDATE ON "loyalty_entries"
FOR EACH ROW EXECUTE FUNCTION loyalty_entry_guard();

ALTER TABLE "loyalty_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_entries" ENABLE ROW LEVEL SECURITY;
