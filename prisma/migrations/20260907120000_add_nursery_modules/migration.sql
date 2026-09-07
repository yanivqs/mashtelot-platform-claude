-- CreateTable
CREATE TABLE "nursery_modules" (
    "id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nursery_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nursery_modules_nursery_id_module_key_key" ON "nursery_modules"("nursery_id", "module_key");

-- AddForeignKey
ALTER TABLE "nursery_modules" ADD CONSTRAINT "nursery_modules_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

