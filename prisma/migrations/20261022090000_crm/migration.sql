-- R06-05/07: CRM — סוג לקוח (פרטי/עסקי), תגיות, קבוצות והערות פנימיות. Expand בלבד; לקוחות קיימים = פרטי, בלי תגיות.
-- לקוח משויך רק לקבוצה של המשתלה שלו (trigger).
-- שחזור: Revert הקוד. הסרה מלאה (לא מורץ): DROP TRIGGER customers_group_same_nursery ON "customers";
--   DROP FUNCTION customer_group_same_nursery(); DROP TABLE "customer_notes"; ALTER TABLE "customers" DROP COLUMN
--   "group_id", "tags", "tax_id", "company_name", "type"; DROP TABLE "customer_groups"; DROP TYPE "CustomerType".

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PRIVATE', 'BUSINESS');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tax_id" TEXT,
ADD COLUMN     "type" "CustomerType" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "customer_groups" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_groups_nursery_id_name_key" ON "customer_groups"("nursery_id", "name");

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_idx" ON "customer_notes"("customer_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "customer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE FUNCTION customer_group_same_nursery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."group_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "customer_groups" g WHERE g."id" = NEW."group_id" AND g."nursery_id" = NEW."nursery_id"
  ) THEN
    RAISE EXCEPTION 'customer % cannot join a group of another nursery', NEW."id";
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER customers_group_same_nursery
BEFORE INSERT OR UPDATE OF "group_id", "nursery_id" ON "customers"
FOR EACH ROW EXECUTE FUNCTION customer_group_same_nursery();

ALTER TABLE "customer_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_notes" ENABLE ROW LEVEL SECURITY;
