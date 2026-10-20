-- §4.04: אימות דו-שלבי (TOTP) — Expand בלבד. משתמשים קיימים נשארים בלי MFA עד שיפעילו.
-- מפתח ה-TOTP נשמר מוצפן (AES-256-GCM, MFA_ENCRYPTION_KEY); קודי שחזור — גיבוב SHA-256 בלבד.
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TABLE "user_recovery_codes";
--   ALTER TABLE "users" DROP COLUMN "mfa_secret_enc", DROP COLUMN "mfa_enabled_at", DROP COLUMN "mfa_last_step".
-- איפוס MFA למשתמש בודד (סופר-אדמין שאיבד גישה, מול ה-DB):
--   UPDATE "users" SET "mfa_secret_enc" = NULL, "mfa_enabled_at" = NULL, "mfa_last_step" = NULL,
--     "session_version" = "session_version" + 1 WHERE "email" = '<email>';
--   DELETE FROM "user_recovery_codes" WHERE "user_id" = (SELECT "id" FROM "users" WHERE "email" = '<email>');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_enabled_at" TIMESTAMP(3),
ADD COLUMN     "mfa_last_step" INTEGER,
ADD COLUMN     "mfa_secret_enc" TEXT;

-- CreateTable
CREATE TABLE "user_recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_recovery_codes_user_id_code_hash_key" ON "user_recovery_codes"("user_id", "code_hash");

-- AddForeignKey
ALTER TABLE "user_recovery_codes" ADD CONSTRAINT "user_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- הפעלה מאושרת מחייבת מפתח
ALTER TABLE "users" ADD CONSTRAINT "users_mfa_enabled_requires_secret" CHECK ("mfa_enabled_at" IS NULL OR "mfa_secret_enc" IS NOT NULL);

ALTER TABLE "user_recovery_codes" ENABLE ROW LEVEL SECURITY;
