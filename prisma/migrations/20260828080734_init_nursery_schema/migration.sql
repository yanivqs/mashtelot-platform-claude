-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'NURSERY_OWNER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "SupplyCategory" AS ENUM ('SOIL', 'POTS', 'PESTICIDES', 'FERTILIZER', 'TOOLS', 'GENERAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintOrderStatus" AS ENUM ('NEW', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "phone_number" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "nursery_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurseries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "custom_domain" TEXT,
    "logo_url" TEXT,
    "primary_color" TEXT DEFAULT '#16a34a',
    "phone_number" TEXT,
    "whatsapp_number" TEXT,
    "owner_email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nurseries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" TEXT NOT NULL,
    "plant_id" INTEGER,
    "hebrew_name" TEXT NOT NULL,
    "latin_name" TEXT,
    "nickname" TEXT,
    "family" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "origin" TEXT,
    "native" TEXT,
    "plant_type" TEXT,
    "light" TEXT,
    "water" TEXT,
    "flowering" TEXT,
    "flowering_season" TEXT,
    "flower_color" TEXT,
    "foliage" TEXT,
    "evergreen" TEXT,
    "height" TEXT,
    "spacing" TEXT,
    "growth_rate" TEXT,
    "climate_zones" TEXT,
    "resistance" TEXT,
    "coastal" TEXT,
    "care" TEXT,
    "uniqueness" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_supplies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "category" "SupplyCategory" NOT NULL DEFAULT 'GENERAL',
    "barcode" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nursery_products" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "plant_id" TEXT,
    "supply_id" TEXT,
    "custom_title" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "compare_at_price" DECIMAL(10,2),
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "custom_description" TEXT,
    "seo_meta_title" TEXT,
    "seo_meta_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursery_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "user_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "shipping_address" TEXT,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "nursery_product_id" TEXT NOT NULL,
    "product_title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount_pct" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "popup_text" TEXT,
    "trigger_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_loyalty" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_loyalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_products" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(10,2) NOT NULL,
    "image_url" TEXT,
    "min_quantity" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_orders" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "ordered_by_id" TEXT,
    "status" "PrintOrderStatus" NOT NULL DEFAULT 'NEW',
    "total_amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "artwork_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_order_items" (
    "id" TEXT NOT NULL,
    "print_order_id" TEXT NOT NULL,
    "print_product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "custom_text" TEXT,

    CONSTRAINT "print_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_global_options" (
    "id" TEXT NOT NULL,
    "option_name" TEXT NOT NULL,
    "extra_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_global_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "nurseries_subdomain_key" ON "nurseries"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "nurseries_custom_domain_key" ON "nurseries"("custom_domain");

-- CreateIndex
CREATE UNIQUE INDEX "plants_plant_id_key" ON "plants"("plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "master_supplies_barcode_key" ON "master_supplies"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "nursery_products_nursery_id_plant_id_key" ON "nursery_products"("nursery_id", "plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "nursery_products_nursery_id_supply_id_key" ON "nursery_products"("nursery_id", "supply_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_nursery_id_code_key" ON "coupons"("nursery_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_loyalty_nursery_id_phone_key" ON "customer_loyalty"("nursery_id", "phone");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_products" ADD CONSTRAINT "nursery_products_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_products" ADD CONSTRAINT "nursery_products_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nursery_products" ADD CONSTRAINT "nursery_products_supply_id_fkey" FOREIGN KEY ("supply_id") REFERENCES "master_supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_nursery_product_id_fkey" FOREIGN KEY ("nursery_product_id") REFERENCES "nursery_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_loyalty" ADD CONSTRAINT "customer_loyalty_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_ordered_by_id_fkey" FOREIGN KEY ("ordered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_print_order_id_fkey" FOREIGN KEY ("print_order_id") REFERENCES "print_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_order_items" ADD CONSTRAINT "print_order_items_print_product_id_fkey" FOREIGN KEY ("print_product_id") REFERENCES "print_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
