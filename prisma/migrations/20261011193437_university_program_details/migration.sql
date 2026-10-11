-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "degreeDetail" TEXT,
ADD COLUMN     "forms" TEXT[],
ADD COLUMN     "languages" TEXT[],
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "regulated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "University" ADD COLUMN     "nacidId" INTEGER,
ADD COLUMN     "nameEn" TEXT,
ALTER COLUMN "website" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Program_degree_idx" ON "Program"("degree");

-- CreateIndex
CREATE INDEX "Program_professionalField_idx" ON "Program"("professionalField");

-- CreateIndex
CREATE UNIQUE INDEX "University_nacidId_key" ON "University"("nacidId");
