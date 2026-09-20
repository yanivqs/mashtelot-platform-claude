-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TELEGRAM', 'LINKEDIN', 'PINTEREST', 'GOOGLE_BUSINESS');

-- CreateTable
CREATE TABLE "nursery_channels" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "value" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursery_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nursery_channels_nursery_id_provider_key" ON "nursery_channels"("nursery_id", "provider");

-- AddForeignKey
ALTER TABLE "nursery_channels" ADD CONSTRAINT "nursery_channels_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: carry existing fixed social/whatsapp columns into nursery_channels before dropping them
INSERT INTO "nursery_channels" ("id", "nursery_id", "provider", "value", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'FACEBOOK', "facebook_url", now(), now()
FROM "nurseries" WHERE "facebook_url" IS NOT NULL AND "facebook_url" <> '';

INSERT INTO "nursery_channels" ("id", "nursery_id", "provider", "value", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'INSTAGRAM', "instagram_url", now(), now()
FROM "nurseries" WHERE "instagram_url" IS NOT NULL AND "instagram_url" <> '';

INSERT INTO "nursery_channels" ("id", "nursery_id", "provider", "value", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'TIKTOK', "tiktok_url", now(), now()
FROM "nurseries" WHERE "tiktok_url" IS NOT NULL AND "tiktok_url" <> '';

INSERT INTO "nursery_channels" ("id", "nursery_id", "provider", "value", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'YOUTUBE', "youtube_url", now(), now()
FROM "nurseries" WHERE "youtube_url" IS NOT NULL AND "youtube_url" <> '';

INSERT INTO "nursery_channels" ("id", "nursery_id", "provider", "value", "created_at", "updated_at")
SELECT gen_random_uuid(), "id", 'WHATSAPP', "whatsapp_number", now(), now()
FROM "nurseries" WHERE "whatsapp_number" IS NOT NULL AND "whatsapp_number" <> '';

-- AlterTable: drop the now-migrated fixed columns
ALTER TABLE "nurseries" DROP COLUMN "facebook_url",
DROP COLUMN "instagram_url",
DROP COLUMN "tiktok_url",
DROP COLUMN "whatsapp_number",
DROP COLUMN "youtube_url";
