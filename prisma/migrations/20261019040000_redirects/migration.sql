-- §14.01 / R07-07: הפניות קבועות לכתובות ישנות, לכל משתלה. תוספת בלבד: טבלה חדשה.
-- RLS ללא policies + ללא הרשאות לתפקידים הציבוריים (כמו C-P0-02).
-- שחזור: הקוד הקודם אינו משתמש בטבלה; הסרה מלאה: DROP TABLE "redirects";

-- CreateTable
CREATE TABLE "redirects" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "last_hit_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redirects_nursery_id_from_path_key" ON "redirects"("nursery_id", "from_path");

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "redirects" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "redirects" FROM anon, authenticated;
  END IF;
END $$;
