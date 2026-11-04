-- נגישות: פרטי הצהרה למשתלה ופניות על בעיות נגישות. Expand בלבד.
-- הסרה מלאה (לא מורץ): DROP TABLE "accessibility_reports"; DROP TYPE "AccessibilityReportStatus"; ALTER TABLE "nurseries" DROP COLUMN "accessibility_info";

-- AlterTable
ALTER TABLE "nurseries" ADD COLUMN "accessibility_info" JSONB;

-- CreateEnum
CREATE TYPE "AccessibilityReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "accessibility_reports" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "page_url" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "status" "AccessibilityReportStatus" NOT NULL DEFAULT 'OPEN',
    "handling_note" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessibility_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accessibility_reports_nursery_id_status_due_at_idx" ON "accessibility_reports"("nursery_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "accessibility_reports_nursery_id_contact_email_idx" ON "accessibility_reports"("nursery_id", "contact_email");

-- AddForeignKey
ALTER TABLE "accessibility_reports" ADD CONSTRAINT "accessibility_reports_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- הגישה רק דרך השרת
ALTER TABLE "accessibility_reports" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "accessibility_reports" FROM anon, authenticated;
  END IF;
END $$;
