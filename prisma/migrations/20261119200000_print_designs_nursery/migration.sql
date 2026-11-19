-- דוגמא ייעודית למשתלה (כרטיס עם הלוגו והפרטים שלה). Expand בלבד: עמודה חדשה, ריקה בדוגמאות הקיימות (= לכל המשתלות).
-- הסרה מלאה (לא מורץ): ALTER TABLE "print_designs" DROP COLUMN "nursery_id";

-- AlterTable
ALTER TABLE "print_designs" ADD COLUMN     "nursery_id" TEXT;

-- CreateIndex
CREATE INDEX "print_designs_nursery_id_idx" ON "print_designs"("nursery_id");

-- AddForeignKey
ALTER TABLE "print_designs" ADD CONSTRAINT "print_designs_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

