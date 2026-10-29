-- וריאנטים בשני צירים (גודל / צבע) — Expand בלבד: עמודות חדשות nullable, אין שינוי בעמודות קיימות.
-- "name" נשאר שם התצוגה (עגלה, הזמנות) ומחושב מהאפשרויות בשמירה.
-- שחזור: Revert הקוד — הבורר חוזר לציר אחד לפי "name". הסרה מלאה (לא מורץ):
--   ALTER TABLE "product_variants" DROP COLUMN "option1", DROP COLUMN "option2", DROP COLUMN "color_hex";
--   ALTER TABLE "nursery_products" DROP COLUMN "option2_label";

ALTER TABLE "nursery_products" ADD COLUMN "option2_label" TEXT;

ALTER TABLE "product_variants" ADD COLUMN "option1" TEXT,
ADD COLUMN "option2" TEXT,
ADD COLUMN "color_hex" TEXT;

-- וריאנטים קיימים: השם הוא ערך הציר הראשון
UPDATE "product_variants" SET "option1" = "name" WHERE "name" <> '';
