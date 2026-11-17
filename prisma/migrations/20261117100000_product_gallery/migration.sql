-- תמונות נוספות למוצר (גלריה בדף המוצר). Expand בלבד: עמודה חדשה עם ברירת מחדל ריקה, בלי שינוי בנתונים קיימים.
-- הסרה מלאה (לא מורץ): ALTER TABLE "nursery_products" DROP COLUMN "gallery_image_urls";

-- AlterTable
ALTER TABLE "nursery_products" ADD COLUMN "gallery_image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
