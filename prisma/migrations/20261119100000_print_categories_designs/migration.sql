-- קטגוריות לקטלוג בית הדפוס (עץ של שתי רמות) ומאגר דוגמאות למוצר דפוס (כרטיסי ברכה). Expand בלבד: טבלאות ועמודות חדשות, בלי שינוי בנתונים קיימים.
-- הסרה מלאה (לא מורץ): DROP TABLE "print_designs"; ALTER TABLE "print_templates" DROP COLUMN "category_id", DROP COLUMN "design_rule"; DROP TABLE "print_categories";

-- AlterTable
ALTER TABLE "print_templates" ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "design_rule" JSONB;

-- CreateTable
CREATE TABLE "print_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_designs" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_designs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "print_categories_slug_key" ON "print_categories"("slug");

-- CreateIndex
CREATE INDEX "print_categories_parent_id_idx" ON "print_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_designs_template_id_code_key" ON "print_designs"("template_id", "code");

-- CreateIndex
CREATE INDEX "print_templates_category_id_idx" ON "print_templates"("category_id");

-- AddForeignKey
ALTER TABLE "print_templates" ADD CONSTRAINT "print_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "print_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_categories" ADD CONSTRAINT "print_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "print_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_designs" ADD CONSTRAINT "print_designs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "print_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- הגישה רק דרך השרת
ALTER TABLE "print_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_designs" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "print_categories" FROM anon, authenticated;
    REVOKE ALL ON TABLE "print_designs" FROM anon, authenticated;
  END IF;
END $$;
