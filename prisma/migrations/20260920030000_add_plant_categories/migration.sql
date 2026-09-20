-- CreateTable
CREATE TABLE "plant_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_category_assignments" (
    "plant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "plant_category_assignments_pkey" PRIMARY KEY ("plant_id","category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plant_categories_name_key" ON "plant_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plant_categories_slug_key" ON "plant_categories"("slug");

-- AddForeignKey
ALTER TABLE "plant_category_assignments" ADD CONSTRAINT "plant_category_assignments_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_category_assignments" ADD CONSTRAINT "plant_category_assignments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "plant_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

