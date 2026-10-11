-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'UNIVERSITY_STUDENT', 'TEACHER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('UNDER_14', 'FROM_14_TO_17', 'ADULT');

-- CreateEnum
CREATE TYPE "LearnerType" AS ENUM ('SCHOOL', 'LANGUAGE_SCHOOL', 'VOCATIONAL', 'UNIVERSITY', 'APPLICANT', 'DRIVING', 'SELF', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailTokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('PRIMARY', 'BASIC', 'SECONDARY', 'PROFILED', 'LANGUAGE', 'VOCATIONAL', 'SPORTS', 'ARTS', 'SPECIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "HigherEdType" AS ENUM ('UNIVERSITY', 'SPECIALIZED_HIGHER_SCHOOL', 'INDEPENDENT_COLLEGE');

-- CreateEnum
CREATE TYPE "Ownership" AS ENUM ('STATE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "Degree" AS ENUM ('PROFESSIONAL_BACHELOR', 'BACHELOR', 'MASTER', 'DOCTOR');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('SCHOOL', 'LANGUAGE', 'VOCATIONAL', 'UNIVERSITY', 'ADMISSION', 'DRIVING', 'FIRST_AID', 'OTHER');

-- CreateEnum
CREATE TYPE "SubjectCategory" AS ENUM ('LANGUAGE_LITERATURE', 'MATHEMATICS', 'FOREIGN_LANGUAGE', 'SCIENCE', 'SOCIAL', 'ARTS', 'TECHNOLOGY', 'SPORT', 'VOCATIONAL', 'UNIVERSITY', 'DRIVING', 'FIRST_AID');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'AI_GENERATED', 'PENDING_REVIEW', 'VERIFIED', 'PUBLISHED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "ContentOrigin" AS ENUM ('HUMAN_AUTHORED', 'AI_ASSISTED', 'AI_GENERATED', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "LessonSectionKind" AS ENUM ('INTRO', 'EXPLANATION', 'EXAMPLES', 'SUMMARY', 'NOTES', 'KEY_FACTS', 'FORMULAS', 'COMMON_MISTAKES', 'ORAL_EXAM_PLAN', 'EXTRA');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_CURRICULUM', 'EDUCATION_STANDARD', 'EXAM_MATERIAL', 'UNIVERSITY_PAGE', 'ADMISSION_GUIDE', 'LEGISLATION', 'DRIVING_OFFICIAL', 'FIRST_AID_OFFICIAL', 'REGISTER', 'REFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceFreshness" AS ENUM ('UNVERIFIED', 'CURRENT', 'NEEDS_REVIEW', 'OUTDATED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING', 'NUMERIC', 'SHORT_TEXT', 'OPEN');

-- CreateEnum
CREATE TYPE "QuestionOrigin" AS ENUM ('AUTHORED', 'OFFICIAL', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "AttemptMode" AS ENUM ('PRACTICE', 'EXAM');

-- CreateEnum
CREATE TYPE "AttemptScope" AS ENUM ('LESSON', 'CURRICULUM', 'DRIVING', 'MISTAKES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "GradedBy" AS ENUM ('AUTO', 'SELF_RUBRIC', 'AI_RUBRIC', 'PENDING');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FlashcardSource" AS ENUM ('LESSON_TERM', 'USER', 'AI');

-- CreateEnum
CREATE TYPE "StudyActivity" AS ENUM ('LESSON', 'QUIZ', 'FLASHCARDS', 'AI_TUTOR');

-- CreateEnum
CREATE TYPE "AIMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AIUsageStatus" AS ENUM ('OK', 'REFUSAL', 'ERROR', 'RATE_LIMITED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REVIEW_DUE', 'EXAM_SOON', 'WEEKLY_REPORT', 'CONTENT_UPDATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "ageGroup" "AgeGroup" NOT NULL DEFAULT 'ADULT',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EmailTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "learnerType" "LearnerType" NOT NULL DEFAULT 'SELF',
    "city" TEXT,
    "schoolId" TEXT,
    "schoolNameCustom" TEXT,
    "grade" INTEGER,
    "schoolProfile" TEXT,
    "foreignLanguages" TEXT[],
    "vocationalSpecialtyId" TEXT,
    "universityId" TEXT,
    "facultyId" TEXT,
    "programId" TEXT,
    "programNameCustom" TEXT,
    "degree" "Degree",
    "courseYear" INTEGER,
    "semester" INTEGER,
    "academicYear" TEXT,
    "targetUniversityId" TEXT,
    "targetProgramText" TEXT,
    "targetExamYear" INTEGER,
    "drivingCategoryCode" TEXT,
    "goals" TEXT[],
    "onboardingCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "emailReminders" BOOLEAN NOT NULL DEFAULT false,
    "inAppReminders" BOOLEAN NOT NULL DEFAULT true,
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 20,
    "weeklyGoalLessons" INTEGER NOT NULL DEFAULT 5,
    "aiExplanationLevel" TEXT NOT NULL DEFAULT 'auto',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserSubject" (
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSubject_pkey" PRIMARY KEY ("userId","subjectId")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "municipality" TEXT,
    "region" TEXT,
    "type" "SchoolType" NOT NULL DEFAULT 'OTHER',
    "externalCode" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "city" TEXT NOT NULL,
    "type" "HigherEdType" NOT NULL,
    "ownership" "Ownership" NOT NULL,
    "website" TEXT NOT NULL,
    "admissionUrl" TEXT,
    "description" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "facultyId" TEXT,
    "name" TEXT NOT NULL,
    "degree" "Degree" NOT NULL,
    "professionalField" TEXT,
    "durationYears" DOUBLE PRECISION,
    "officialUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionInfo" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "programId" TEXT,
    "admissionYear" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "exams" TEXT[],
    "sourceId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationStatus" "SourceFreshness" NOT NULL DEFAULT 'UNVERIFIED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocationalArea" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fieldName" TEXT,
    "description" TEXT,

    CONSTRAINT "VocationalArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocationalProfession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "VocationalProfession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocationalSpecialty" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "professionId" TEXT NOT NULL,
    "qualificationLevel" INTEGER,

    CONSTRAINT "VocationalSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "EducationLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolGrade" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "educationLevelId" TEXT NOT NULL,

    CONSTRAINT "SchoolGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "category" "SubjectCategory" NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1F3A5F',
    "icon" TEXT NOT NULL DEFAULT 'book',
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumVersion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeId" INTEGER,
    "variant" TEXT,
    "vocationalSpecialtyId" TEXT,
    "programId" TEXT,
    "drivingCategoryCode" TEXT,
    "description" TEXT,
    "isOfficialStructure" BOOLEAN NOT NULL DEFAULT false,
    "structureNote" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "sourceId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumSection" (
    "id" TEXT NOT NULL,
    "curriculumVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CurriculumSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumTopic" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "CurriculumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicLesson" (
    "topicId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "TopicLesson_pkey" PRIMARY KEY ("topicId","lessonId")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "freshness" "SourceFreshness" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "lastHttpStatus" INTEGER,
    "verificationNote" TEXT,
    "relatedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gradeId" INTEGER,
    "curriculumVersionId" TEXT NOT NULL,
    "sectionId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 100,
    "level" TEXT,
    "summary" TEXT,
    "objectives" TEXT[],
    "prerequisites" TEXT[],
    "keywords" TEXT[],
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 20,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" "ContentOrigin" NOT NULL DEFAULT 'AI_ASSISTED',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT,
    "editorName" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentHash" TEXT,
    "sourceFile" TEXT,
    "importedAt" TIMESTAMP(3),
    "editedInAdminAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSection" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" "LessonSectionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "LessonSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonTerm" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "LessonTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonQA" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "LessonQA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "hint" TEXT,
    "solution" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSource" (
    "lessonId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "LessonSource_pkey" PRIMARY KEY ("lessonId","sourceId")
);

-- CreateTable
CREATE TABLE "ContentReview" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "fromStatus" "ContentStatus" NOT NULL,
    "toStatus" "ContentStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonRevision" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "externalKey" TEXT,
    "lessonId" TEXT,
    "curriculumVersionId" TEXT,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "acceptedAnswers" TEXT[],
    "numericAnswer" DOUBLE PRECISION,
    "numericTolerance" DOUBLE PRECISION,
    "matchingPairs" JSONB,
    "rubric" TEXT[],
    "modelAnswer" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "points" INTEGER NOT NULL DEFAULT 1,
    "origin" "QuestionOrigin" NOT NULL DEFAULT 'AUTHORED',
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "sourceId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "AttemptMode" NOT NULL DEFAULT 'PRACTICE',
    "scope" "AttemptScope" NOT NULL,
    "title" TEXT NOT NULL,
    "lessonId" TEXT,
    "curriculumVersionId" TEXT,
    "drivingCategoryCode" TEXT,
    "questionIds" TEXT[],
    "timeLimitSec" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "percent" DOUBLE PRECISION,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPoints" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "gradedBy" "GradedBy" NOT NULL DEFAULT 'AUTO',
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionState" (
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "timesSeen" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "timesWrong" INTEGER NOT NULL DEFAULT 0,
    "lastCorrect" BOOLEAN,
    "lastAnsweredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQuestionState_pkey" PRIMARY KEY ("userId","questionId")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "viewedUnderstand" BOOLEAN NOT NULL DEFAULT false,
    "viewedLearn" BOOLEAN NOT NULL DEFAULT false,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "timeSpentSec" INTEGER NOT NULL DEFAULT 0,
    "bestQuizPercent" DOUBLE PRECISION,
    "lastQuizPercent" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateTable
CREATE TABLE "UserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","lessonId")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "lessonId" TEXT,
    "termId" TEXT,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "source" "FlashcardSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewState" (
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewState_pkey" PRIMARY KEY ("userId","flashcardId")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "examDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL,

    CONSTRAINT "StudyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activity" "StudyActivity" NOT NULL,
    "lessonId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExam" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AIMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "hadImage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "purpose" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "status" "AIUsageStatus" NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrivingCategory" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minAge" INTEGER,
    "order" INTEGER NOT NULL,

    CONSTRAINT "DrivingCategory_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "DrivingTopic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "DrivingTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrivingQuestion" (
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "categoryCodes" TEXT[],
    "officialNumber" TEXT,

    CONSTRAINT "DrivingQuestion_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" TEXT,
    "digest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "kind" TEXT NOT NULL,
    "filename" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevEmail" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailToken_tokenHash_key" ON "EmailToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailToken_userId_type_idx" ON "EmailToken"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "School_externalCode_key" ON "School"("externalCode");

-- CreateIndex
CREATE INDEX "School_city_idx" ON "School"("city");

-- CreateIndex
CREATE INDEX "School_name_idx" ON "School"("name");

-- CreateIndex
CREATE UNIQUE INDEX "University_slug_key" ON "University"("slug");

-- CreateIndex
CREATE INDEX "University_city_idx" ON "University"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_universityId_name_key" ON "Faculty"("universityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- CreateIndex
CREATE INDEX "Program_universityId_idx" ON "Program"("universityId");

-- CreateIndex
CREATE INDEX "AdmissionInfo_universityId_admissionYear_idx" ON "AdmissionInfo"("universityId", "admissionYear");

-- CreateIndex
CREATE UNIQUE INDEX "VocationalArea_code_key" ON "VocationalArea"("code");

-- CreateIndex
CREATE UNIQUE INDEX "VocationalProfession_code_key" ON "VocationalProfession"("code");

-- CreateIndex
CREATE UNIQUE INDEX "VocationalSpecialty_code_key" ON "VocationalSpecialty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_slug_key" ON "Subject"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumVersion_slug_key" ON "CurriculumVersion"("slug");

-- CreateIndex
CREATE INDEX "CurriculumVersion_track_gradeId_idx" ON "CurriculumVersion"("track", "gradeId");

-- CreateIndex
CREATE INDEX "CurriculumVersion_subjectId_idx" ON "CurriculumVersion"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumSection_curriculumVersionId_order_key" ON "CurriculumSection"("curriculumVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumTopic_sectionId_order_key" ON "CurriculumTopic"("sectionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Source_url_key" ON "Source"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_slug_key" ON "Lesson"("slug");

-- CreateIndex
CREATE INDEX "Lesson_curriculumVersionId_order_idx" ON "Lesson"("curriculumVersionId", "order");

-- CreateIndex
CREATE INDEX "Lesson_subjectId_gradeId_idx" ON "Lesson"("subjectId", "gradeId");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- CreateIndex
CREATE INDEX "LessonSection_lessonId_order_idx" ON "LessonSection"("lessonId", "order");

-- CreateIndex
CREATE INDEX "LessonTerm_lessonId_idx" ON "LessonTerm"("lessonId");

-- CreateIndex
CREATE INDEX "LessonTerm_term_idx" ON "LessonTerm"("term");

-- CreateIndex
CREATE INDEX "LessonQA_lessonId_idx" ON "LessonQA"("lessonId");

-- CreateIndex
CREATE INDEX "Exercise_lessonId_idx" ON "Exercise"("lessonId");

-- CreateIndex
CREATE INDEX "ContentReview_lessonId_idx" ON "ContentReview"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonRevision_lessonId_version_key" ON "LessonRevision"("lessonId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Question_externalKey_key" ON "Question"("externalKey");

-- CreateIndex
CREATE INDEX "Question_lessonId_idx" ON "Question"("lessonId");

-- CreateIndex
CREATE INDEX "Question_curriculumVersionId_idx" ON "Question"("curriculumVersionId");

-- CreateIndex
CREATE INDEX "AnswerOption_questionId_idx" ON "AnswerOption"("questionId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_userId_startedAt_idx" ON "AssessmentAttempt"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_attemptId_questionId_key" ON "AssessmentAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "UserQuestionState_userId_lastCorrect_idx" ON "UserQuestionState"("userId", "lastCorrect");

-- CreateIndex
CREATE INDEX "LessonProgress_userId_lastOpenedAt_idx" ON "LessonProgress"("userId", "lastOpenedAt");

-- CreateIndex
CREATE INDEX "UserNote_userId_updatedAt_idx" ON "UserNote"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Flashcard_termId_key" ON "Flashcard"("termId");

-- CreateIndex
CREATE INDEX "Flashcard_lessonId_idx" ON "Flashcard"("lessonId");

-- CreateIndex
CREATE INDEX "Flashcard_userId_idx" ON "Flashcard"("userId");

-- CreateIndex
CREATE INDEX "ReviewState_userId_dueAt_idx" ON "ReviewState"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "StudyPlan_userId_idx" ON "StudyPlan"("userId");

-- CreateIndex
CREATE INDEX "StudyPlanItem_planId_order_idx" ON "StudyPlanItem"("planId", "order");

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "UserExam_userId_date_idx" ON "UserExam"("userId", "date");

-- CreateIndex
CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "AIConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageRecord_userId_createdAt_idx" ON "AIUsageRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageRecord_createdAt_idx" ON "AIUsageRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DrivingTopic_slug_key" ON "DrivingTopic"("slug");

-- CreateIndex
CREATE INDEX "DrivingQuestion_topicId_idx" ON "DrivingQuestion"("topicId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_vocationalSpecialtyId_fkey" FOREIGN KEY ("vocationalSpecialtyId") REFERENCES "VocationalSpecialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_targetUniversityId_fkey" FOREIGN KEY ("targetUniversityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubject" ADD CONSTRAINT "UserSubject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubject" ADD CONSTRAINT "UserSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "University" ADD CONSTRAINT "University_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionInfo" ADD CONSTRAINT "AdmissionInfo_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionInfo" ADD CONSTRAINT "AdmissionInfo_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionInfo" ADD CONSTRAINT "AdmissionInfo_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocationalProfession" ADD CONSTRAINT "VocationalProfession_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "VocationalArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocationalSpecialty" ADD CONSTRAINT "VocationalSpecialty_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "VocationalProfession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolGrade" ADD CONSTRAINT "SchoolGrade_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "EducationLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "SchoolGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_vocationalSpecialtyId_fkey" FOREIGN KEY ("vocationalSpecialtyId") REFERENCES "VocationalSpecialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumVersion" ADD CONSTRAINT "CurriculumVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumSection" ADD CONSTRAINT "CurriculumSection_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumTopic" ADD CONSTRAINT "CurriculumTopic_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CurriculumSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicLesson" ADD CONSTRAINT "TopicLesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "CurriculumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicLesson" ADD CONSTRAINT "TopicLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "SchoolGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CurriculumSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSection" ADD CONSTRAINT "LessonSection_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonTerm" ADD CONSTRAINT "LessonTerm_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonQA" ADD CONSTRAINT "LessonQA_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSource" ADD CONSTRAINT "LessonSource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSource" ADD CONSTRAINT "LessonSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReview" ADD CONSTRAINT "ContentReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonRevision" ADD CONSTRAINT "LessonRevision_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonRevision" ADD CONSTRAINT "LessonRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_curriculumVersionId_fkey" FOREIGN KEY ("curriculumVersionId") REFERENCES "CurriculumVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionState" ADD CONSTRAINT "UserQuestionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionState" ADD CONSTRAINT "UserQuestionState_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNote" ADD CONSTRAINT "UserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNote" ADD CONSTRAINT "UserNote_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_termId_fkey" FOREIGN KEY ("termId") REFERENCES "LessonTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewState" ADD CONSTRAINT "ReviewState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewState" ADD CONSTRAINT "ReviewState_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExam" ADD CONSTRAINT "UserExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExam" ADD CONSTRAINT "UserExam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageRecord" ADD CONSTRAINT "AIUsageRecord_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingQuestion" ADD CONSTRAINT "DrivingQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingQuestion" ADD CONSTRAINT "DrivingQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "DrivingTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
