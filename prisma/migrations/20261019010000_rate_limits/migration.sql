-- S-22: מוני הגבלת קצב משותפים לכל מופעי השרת (במקום Map בזיכרון של כל מופע).
-- תוספת בלבד: טבלה חדשה. RLS ללא policies + ללא הרשאות לתפקידים הציבוריים (כמו C-P0-02).
-- שחזור: הקוד הקודם אינו משתמש בטבלה; הסרה מלאה: DROP TABLE "rate_limits";

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits"("expires_at");

ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "rate_limits" FROM anon, authenticated;
  END IF;
END $$;
