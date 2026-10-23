-- R03: Page Builder — Expand בלבד (טבלאות חדשות; אין שינוי בטבלאות קיימות).
-- שחזור: Revert הקוד — החנות חוזרת לתצוגה הרגילה. הסרה מלאה (לא מורץ): DROP TABLE "page_layout_versions", "page_layouts";

-- CreateTable
CREATE TABLE "page_layouts" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "static_page_id" TEXT,
    "draft_blocks" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_layout_versions" (
    "id" TEXT NOT NULL,
    "layout_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "publish_at" TIMESTAMP(3) NOT NULL,
    "created_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_layout_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_layouts_static_page_id_key" ON "page_layouts"("static_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "page_layouts_nursery_id_key_key" ON "page_layouts"("nursery_id", "key");

-- CreateIndex
CREATE INDEX "page_layout_versions_layout_id_publish_at_idx" ON "page_layout_versions"("layout_id", "publish_at");

-- CreateIndex
CREATE UNIQUE INDEX "page_layout_versions_layout_id_version_key" ON "page_layout_versions"("layout_id", "version");

-- AddForeignKey
ALTER TABLE "page_layouts" ADD CONSTRAINT "page_layouts_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_layouts" ADD CONSTRAINT "page_layouts_static_page_id_fkey" FOREIGN KEY ("static_page_id") REFERENCES "static_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_layout_versions" ADD CONSTRAINT "page_layout_versions_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "page_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- C-P0-02: RLS ללא הרשאות ציבוריות (default privileges כבר מבוטלות)
ALTER TABLE "page_layouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "page_layout_versions" ENABLE ROW LEVEL SECURITY;
