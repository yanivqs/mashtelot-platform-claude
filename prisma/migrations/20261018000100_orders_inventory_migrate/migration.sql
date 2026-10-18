-- C-P1-02 (Migrate): ברירת המחדל החדשה והמרת הזמנות קיימות.
-- במודל הקודם המלאי ירד כבר ביצירת ההזמנה, ולכן הזמנות קיימות (שאינן הצעת מחיר)
-- מסומנות COMMITTED: ביטול עתידי שלהן יחזיר את המלאי, ושליחה לא תוריד אותו שוב.
-- ערכי הסטטוס הישנים נשארים ב-enum (Contract יבוצע בנפרד, אחרי שהקוד הישן אינו בשימוש).

ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'RECEIVED';

-- תשלום: הזמנות שסומנו בעבר "שולם"
UPDATE "orders" SET "payment_status" = 'PAID' WHERE "status" = 'PAID';

-- מלאי: הזמנות אונליין מהמודל הקודם — המלאי כבר ירד
UPDATE "orders" SET "stock_state" = 'COMMITTED' WHERE "status" <> 'QUOTE_REQUESTED';

-- סטטוסים: מיפוי לערכי R05-07
UPDATE "orders" SET "status" = 'RECEIVED'  WHERE "status" = 'PENDING';
UPDATE "orders" SET "status" = 'CONFIRMED' WHERE "status" = 'PAID';
UPDATE "orders" SET "status" = 'PREPARING' WHERE "status" = 'PROCESSING';
