-- מוצר "תמיד במלאי": זמין למכירה בלי קשר לכמות, בלי שמירה/הורדת מלאי
ALTER TABLE "nursery_products" ADD COLUMN "always_in_stock" BOOLEAN NOT NULL DEFAULT false;

-- לכל שורת הזמנה: האם נשמר/ירד עבורה מלאי (Snapshot בזמן ההזמנה — שינוי ההגדרה במוצר
-- לא משבש הזמנות פתוחות: שחרור/אישור/ביטול פועלים רק על שורות שנשמרו)
ALTER TABLE "order_items" ADD COLUMN "stock_tracked" BOOLEAN NOT NULL DEFAULT true;
