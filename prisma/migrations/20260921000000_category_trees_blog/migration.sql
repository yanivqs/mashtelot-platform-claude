-- AlterTable
ALTER TABLE "nursery_products" ADD COLUMN     "custom_image_url" TEXT;

-- AlterTable
ALTER TABLE "plant_categories" ADD COLUMN     "parent_id" TEXT;

-- CreateTable
CREATE TABLE "nursery_categories" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nursery_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursery_product_categories" (
    "nursery_product_id" TEXT NOT NULL,
    "nursery_category_id" TEXT NOT NULL,

    CONSTRAINT "nursery_product_categories_pkey" PRIMARY KEY ("nursery_product_id","nursery_category_id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content_html" TEXT NOT NULL DEFAULT '',
    "cover_image_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "seo_meta_title" TEXT,
    "seo_meta_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nursery_categories_nursery_id_slug_key" ON "nursery_categories"("nursery_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_nursery_id_slug_key" ON "blog_posts"("nursery_id", "slug");

-- AddForeignKey
ALTER TABLE "plant_categories" ADD CONSTRAINT "plant_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "plant_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_categories" ADD CONSTRAINT "nursery_categories_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_categories" ADD CONSTRAINT "nursery_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "nursery_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_product_categories" ADD CONSTRAINT "nursery_product_categories_nursery_product_id_fkey" FOREIGN KEY ("nursery_product_id") REFERENCES "nursery_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_product_categories" ADD CONSTRAINT "nursery_product_categories_nursery_category_id_fkey" FOREIGN KEY ("nursery_category_id") REFERENCES "nursery_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

