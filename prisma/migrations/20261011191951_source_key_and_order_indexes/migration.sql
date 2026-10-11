-- DropIndex
DROP INDEX "CurriculumSection_curriculumVersionId_order_key";

-- DropIndex
DROP INDEX "CurriculumTopic_sectionId_order_key";

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE INDEX "CurriculumSection_curriculumVersionId_order_idx" ON "CurriculumSection"("curriculumVersionId", "order");

-- CreateIndex
CREATE INDEX "CurriculumTopic_sectionId_order_idx" ON "CurriculumTopic"("sectionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");
