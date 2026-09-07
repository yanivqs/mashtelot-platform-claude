-- AlterTable
ALTER TABLE "nurseries" ADD COLUMN     "about_text" TEXT,
ADD COLUMN     "address_line" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "facebook_url" TEXT,
ADD COLUMN     "instagram_url" TEXT,
ADD COLUMN     "map_link" TEXT,
ADD COLUMN     "opening_hours" JSONB,
ADD COLUMN     "theme_config" JSONB,
ADD COLUMN     "tiktok_url" TEXT,
ADD COLUMN     "youtube_url" TEXT;
