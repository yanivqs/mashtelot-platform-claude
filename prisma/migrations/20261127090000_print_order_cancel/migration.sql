-- ביטול הזמנת דפוס בידי המשתלה: מתי ומי (תוספת בלבד)
ALTER TABLE "print_orders" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "print_orders" ADD COLUMN "cancelled_by" TEXT;
