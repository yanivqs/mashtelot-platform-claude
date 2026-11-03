-- תפוצת דואר של משתלה. Expand בלבד. הסרה מלאה (לא מורץ): DROP TABLE "newsletter_subscribers".

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_nursery_id_email_key" ON "newsletter_subscribers"("nursery_id", "email");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_nursery_id_created_at_idx" ON "newsletter_subscribers"("nursery_id", "created_at");

-- AddForeignKey
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- הגישה רק דרך השרת
ALTER TABLE "newsletter_subscribers" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "newsletter_subscribers" FROM anon, authenticated;
  END IF;
END $$;
