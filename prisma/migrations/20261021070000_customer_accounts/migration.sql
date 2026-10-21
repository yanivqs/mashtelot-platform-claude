-- R06-03 / §13.02: חשבונות לקוח בחנות (מודול "חשבונות לקוח") — Expand בלבד. הזמנות קיימות לא משתנות.
-- התחברות בקוד חד-פעמי במייל: נשמר רק HMAC של הקוד. הזמנה משויכת ללקוח של אותה משתלה בלבד (trigger).
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TRIGGER orders_customer_same_nursery ON "orders";
--   DROP FUNCTION order_customer_same_nursery(); ALTER TABLE "orders" DROP COLUMN "customer_id";
--   DROP TABLE "customer_otps"; DROP TABLE "customers".

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_id" TEXT;

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "phone" TEXT,
    "marketing_consent_at" TIMESTAMP(3),
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_otps" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_nursery_id_email_key" ON "customers"("nursery_id", "email");

-- CreateIndex
CREATE INDEX "customer_otps_nursery_id_email_idx" ON "customer_otps"("nursery_id", "email");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_otps" ADD CONSTRAINT "customer_otps_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- הזמנה יכולה להשתייך רק ללקוח של אותה משתלה (בידוד Tenant גם במסד)
CREATE FUNCTION order_customer_same_nursery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."customer_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "customers" c WHERE c."id" = NEW."customer_id" AND c."nursery_id" = NEW."nursery_id"
  ) THEN
    RAISE EXCEPTION 'order % cannot belong to a customer of another nursery', NEW."id";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER orders_customer_same_nursery
BEFORE INSERT OR UPDATE OF "customer_id", "nursery_id" ON "orders"
FOR EACH ROW EXECUTE FUNCTION order_customer_same_nursery();

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_otps" ENABLE ROW LEVEL SECURITY;
