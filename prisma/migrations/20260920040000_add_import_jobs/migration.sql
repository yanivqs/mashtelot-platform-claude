-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('DRY_RUN_COMPLETE', 'COMMITTED', 'FAILED');

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "created_by_email" TEXT,
    "original_filename" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL,
    "row_count" INTEGER NOT NULL,
    "create_count" INTEGER NOT NULL,
    "update_count" INTEGER NOT NULL,
    "error_count" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_file_hash_idx" ON "import_jobs"("file_hash");

