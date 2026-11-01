-- תיקיית תמונות למשתלה: תמונות שהועלו ומחכות לשיוך למוצרים
CREATE TABLE "nursery_images" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursery_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nursery_images_url_key" ON "nursery_images"("url");
CREATE INDEX "nursery_images_nursery_id_created_at_idx" ON "nursery_images"("nursery_id", "created_at");

ALTER TABLE "nursery_images" ADD CONSTRAINT "nursery_images_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- כמו בכל הטבלאות: גישה רק דרך השרת, לא דרך ה-API הציבורי של Supabase
ALTER TABLE "nursery_images" ENABLE ROW LEVEL SECURITY;
