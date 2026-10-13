-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('QUEUED', 'DISCOVERED', 'EXTRACTED', 'GENERATED', 'CHECKS_FAILED', 'AWAITING_REVIEW', 'PUBLISHED', 'REJECTED', 'UNCLASSIFIED', 'BLOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineJobKind" AS ENUM ('DISCOVER', 'EXTRACT', 'GENERATE', 'CHECK');

-- CreateEnum
CREATE TYPE "PipelineJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PipelineLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "PipelineCheckResult" AS ENUM ('PASS', 'WARN', 'FAIL');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'bg';

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "license" TEXT,
ADD COLUMN     "licenseUrl" TEXT;

-- CreateTable
CREATE TABLE "PipelineItem" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'bg',
    "topicId" TEXT,
    "stage" "PipelineStage" NOT NULL DEFAULT 'QUEUED',
    "lastError" TEXT,
    "blockedCode" TEXT,
    "lessonId" TEXT,
    "candidates" JSONB,
    "generation" JSONB,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "revisionId" TEXT,
    "revisedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "detectedLanguage" TEXT,
    "license" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "attribution" TEXT NOT NULL,
    "accessBasis" TEXT NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "heading" TEXT,
    "text" TEXT NOT NULL,

    CONSTRAINT "SourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineItemDocument" (
    "itemId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,

    CONSTRAINT "PipelineItemDocument_pkey" PRIMARY KEY ("itemId","documentId")
);

-- CreateTable
CREATE TABLE "PipelineJob" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" "PipelineJobKind" NOT NULL,
    "status" "PipelineJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineEvent" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "level" "PipelineLogLevel" NOT NULL DEFAULT 'INFO',
    "stage" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineCheck" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "result" "PipelineCheckResult" NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineItem_stage_updatedAt_idx" ON "PipelineItem"("stage", "updatedAt");

-- CreateIndex
CREATE INDEX "PipelineItem_topicId_idx" ON "PipelineItem"("topicId");

-- CreateIndex
CREATE INDEX "SourceDocument_sourceId_idx" ON "SourceDocument"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_provider_externalId_contentHash_key" ON "SourceDocument"("provider", "externalId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "SourceChunk_documentId_index_key" ON "SourceChunk"("documentId", "index");

-- CreateIndex
CREATE INDEX "PipelineJob_status_runAfter_idx" ON "PipelineJob"("status", "runAfter");

-- CreateIndex
CREATE INDEX "PipelineJob_itemId_idx" ON "PipelineJob"("itemId");

-- CreateIndex
CREATE INDEX "PipelineEvent_itemId_createdAt_idx" ON "PipelineEvent"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineCheck_itemId_idx" ON "PipelineCheck"("itemId");

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "CurriculumTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItem" ADD CONSTRAINT "PipelineItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceChunk" ADD CONSTRAINT "SourceChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItemDocument" ADD CONSTRAINT "PipelineItemDocument_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PipelineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineItemDocument" ADD CONSTRAINT "PipelineItemDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineJob" ADD CONSTRAINT "PipelineJob_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PipelineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineEvent" ADD CONSTRAINT "PipelineEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PipelineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineCheck" ADD CONSTRAINT "PipelineCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PipelineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
