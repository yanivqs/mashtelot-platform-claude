-- PT-06 (נספח א.7): מצב ייצור ושער שחרור — Expand בלבד. הזמנות קיימות מקבלות PENDING.
-- trigger: אי אפשר להגיע ל-RELEASED (או הלאה) בלי תיעוד שחרור; אחרי שחרור — מי/מתי, ה-Snapshot וקובץ הייצור
-- אינם משתנים. קובץ הייצור מוגן ממחיקה (NO ACTION, נדחה לסוף הטרנזקציה — מחיקת משתלה מדורגת עובדת).
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TRIGGER/FUNCTION, DROP COLUMN (8 עמודות ב-print_orders,
--   requires_artwork ב-print_templates), DROP TYPE "PrintProductionStatus".

-- CreateEnum
CREATE TYPE "PrintProductionStatus" AS ENUM ('PENDING', 'RELEASED', 'IN_PRODUCTION', 'QC', 'COMPLETED', 'BLOCKED');

-- AlterTable
ALTER TABLE "print_orders" ADD COLUMN     "production_file_id" TEXT,
ADD COLUMN     "production_note" TEXT,
ADD COLUMN     "production_status" "PrintProductionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "release_snapshot" JSONB,
ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "released_by" TEXT,
ADD COLUMN     "spec_approved_at" TIMESTAMP(3),
ADD COLUMN     "spec_approved_by" TEXT;

-- AlterTable
ALTER TABLE "print_templates" ADD COLUMN     "requires_artwork" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_production_file_id_fkey" FOREIGN KEY ("production_file_id") REFERENCES "print_files"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


ALTER TABLE "print_orders" ALTER CONSTRAINT "print_orders_production_file_id_fkey" DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION print_order_release_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."production_status" IN ('RELEASED', 'IN_PRODUCTION', 'QC', 'COMPLETED')
     AND (NEW."released_at" IS NULL OR NEW."release_snapshot" IS NULL OR NEW."production_file_id" IS NULL) THEN
    RAISE EXCEPTION 'print order % cannot be % without a recorded release', NEW."id", NEW."production_status";
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."released_at" IS NOT NULL AND (
       NEW."released_at" IS DISTINCT FROM OLD."released_at" OR NEW."released_by" IS DISTINCT FROM OLD."released_by"
    OR NEW."release_snapshot" IS DISTINCT FROM OLD."release_snapshot" OR NEW."production_file_id" IS DISTINCT FROM OLD."production_file_id") THEN
    RAISE EXCEPTION 'release of print order % is immutable', OLD."id";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER print_orders_release_guard
BEFORE INSERT OR UPDATE ON "print_orders"
FOR EACH ROW EXECUTE FUNCTION print_order_release_guard();
