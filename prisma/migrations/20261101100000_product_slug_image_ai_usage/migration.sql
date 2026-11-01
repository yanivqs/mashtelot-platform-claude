-- כתובת מוצר לעריכה + חובת תמונה לשיוך מהקטלוג
ALTER TABLE "nursery_products" ADD COLUMN "slug" TEXT;
ALTER TABLE "nursery_products" ADD COLUMN "image_required" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "nursery_products_nursery_id_slug_key" ON "nursery_products"("nursery_id", "slug");

-- תיוג תמונות קטלוג שהועתקו מאתר חיצוני
ALTER TABLE "plants" ADD COLUMN "image_needs_update" BOOLEAN NOT NULL DEFAULT false;

-- שימוש בכלי AI
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT,
    "actor_email" TEXT,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ai_usage_nursery_id_created_at_idx" ON "ai_usage"("nursery_id", "created_at");
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- כמו שאר הטבלאות: אין גישה מ-PostgREST (anon/authenticated)
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "ai_usage" FROM anon, authenticated;
  END IF;
END $$;
