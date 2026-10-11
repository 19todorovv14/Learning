-- AlterTable
ALTER TABLE "CurriculumVersion" ADD COLUMN     "vocationalProfessionId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "vocationalProfessionId" TEXT;

-- AlterTable
ALTER TABLE "VocationalArea" DROP COLUMN "description",
ADD COLUMN     "fieldCode" TEXT,
ADD COLUMN     "listVersion" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VocationalProfession" ADD COLUMN     "listVersion" TEXT NOT NULL,
ADD COLUMN     "qualificationLevels" INTEGER[],
ADD COLUMN     "regulated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VocationalSpecialty" ADD COLUMN     "newProfessionCode" TEXT;

-- CreateIndex
CREATE INDEX "VocationalProfession_areaId_idx" ON "VocationalProfession"("areaId");

-- CreateIndex
CREATE INDEX "VocationalSpecialty_professionId_idx" ON "VocationalSpecialty"("professionId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_vocationalProfessionId_fkey" FOREIGN KEY ("vocationalProfessionId") REFERENCES "VocationalProfession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_vocationalProfessionId_fkey" FOREIGN KEY ("vocationalProfessionId") REFERENCES "VocationalProfession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
