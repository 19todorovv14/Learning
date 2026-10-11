-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentReport_resolvedAt_createdAt_idx" ON "ContentReport"("resolvedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
