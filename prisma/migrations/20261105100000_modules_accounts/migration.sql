-- מודולים לפי חלקים, חשבונות משתלות, ומחיקה רכה של מוצר — Expand בלבד.
-- משתלות קיימות לא מאבדות דבר: כל יכולת שהייתה פעילה ממשיכה בחלקים החדשים, ובלי רשומת חשבון אין חסימה.
-- שחזור: Revert הקוד — העמודות והטבלאות אינן חובה. הסרה מלאה (לא מורץ): DROP TABLE nursery_accounts, platform_settings,
--   DROP TYPE "AccountPaymentMethod", "AccountBillingType", DROP COLUMN nursery_products.deleted_at,
--   nursery_modules.setup_fee, nursery_modules.monthly_fee. שורות המודולים החדשות לא משפיעות על קוד ישן.

-- CreateEnum
CREATE TYPE "AccountPaymentMethod" AS ENUM ('TRANSFER', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "AccountBillingType" AS ENUM ('ONE_TIME', 'MONTHLY');

-- AlterTable
ALTER TABLE "nursery_products" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "nursery_modules"
  ADD COLUMN "setup_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "monthly_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "nursery_accounts" (
    "nursery_id" TEXT NOT NULL,
    "joined_at" DATE,
    "billing_date" DATE,
    "amount_due" DECIMAL(10,2),
    "payment_method" "AccountPaymentMethod",
    "billing_type" "AccountBillingType",
    "valid_until" DATE,
    "base_setup_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "base_monthly_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "suspended_at" TIMESTAMP(3),
    "suspend_reason" TEXT,
    "last_paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursery_accounts_pkey" PRIMARY KEY ("nursery_id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "nursery_accounts" ADD CONSTRAINT "nursery_accounts_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nursery_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "nursery_accounts" FROM anon, authenticated;
    REVOKE ALL ON TABLE "platform_settings" FROM anon, authenticated;
  END IF;
END $$;

-- שיווק מתפצל לשלושה חלקים
INSERT INTO "nursery_modules" ("id", "nursery_id", "module_key", "is_enabled", "updated_at")
SELECT gen_random_uuid()::text, m."nursery_id", k.key, true, CURRENT_TIMESTAMP
FROM "nursery_modules" m
CROSS JOIN (VALUES ('announcement'), ('coupons'), ('popups')) AS k(key)
WHERE m."module_key" = 'promotions' AND m."is_enabled" = true
ON CONFLICT ("nursery_id", "module_key") DO NOTHING;

-- אפשרויות התשלום והמשלוח היו חלק ממודול המכירה
INSERT INTO "nursery_modules" ("id", "nursery_id", "module_key", "is_enabled", "updated_at")
SELECT gen_random_uuid()::text, m."nursery_id", k.key, true, CURRENT_TIMESTAMP
FROM "nursery_modules" m
CROSS JOIN (VALUES ('payment_options'), ('delivery_options')) AS k(key)
WHERE m."module_key" = 'sales' AND m."is_enabled" = true
ON CONFLICT ("nursery_id", "module_key") DO NOTHING;

-- ניהול צוות היה זמין לכל בעל משתלה
INSERT INTO "nursery_modules" ("id", "nursery_id", "module_key", "is_enabled", "updated_at")
SELECT gen_random_uuid()::text, n."id", 'team', true, CURRENT_TIMESTAMP
FROM "nurseries" n
ON CONFLICT ("nursery_id", "module_key") DO NOTHING;
