import { z } from "zod";

export const CONTENT_STATUSES = ["DRAFT", "AI_GENERATED", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "OUTDATED"] as const;
export const CONTENT_ORIGINS = ["HUMAN_AUTHORED", "AI_ASSISTED", "AI_GENERATED", "OFFICIAL"] as const;
export const TRACKS = ["SCHOOL", "LANGUAGE", "VOCATIONAL", "UNIVERSITY", "ADMISSION", "DRIVING", "FIRST_AID", "OTHER"] as const;

export const SECTION_KINDS = [
  "INTRO",
  "EXPLANATION",
  "EXAMPLES",
  "SUMMARY",
  "NOTES",
  "KEY_FACTS",
  "FORMULAS",
  "COMMON_MISTAKES",
  "ORAL_EXAM_PLAN",
  "EXTRA",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
  "NUMERIC",
  "SHORT_TEXT",
  "OPEN",
] as const;
export type QuestionTypeName = (typeof QUESTION_TYPES)[number];

const str = z.string().trim().min(1);

export const lessonFrontmatterSchema = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug: само малки латински букви, цифри и тирета")
      .optional(),
    title: str,
    curriculum: str,
    topic: str,
    also: z.array(z.string().regex(/^[a-z0-9-]+\|.+$/, "also: формат „curriculum-slug|Тема“")).default([]),
    order: z.number().int().min(0).default(1),
    minutes: z.number().int().min(3).max(240).default(20),
    summary: z.string().trim().max(400).optional(),
    objectives: z.array(str).default([]),
    prerequisites: z.array(str).default([]),
    keywords: z.array(str).default([]),
    status: z.enum(CONTENT_STATUSES).default("PENDING_REVIEW"),
    origin: z.enum(CONTENT_ORIGINS).default("AI_ASSISTED"),
    demo: z.boolean().default(false),
    author: z.string().optional(),
    sources: z.array(str).default([]),
  })
  .strict();

export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

export type ParsedSection = { kind: SectionKind; title: string; body: string; order: number };
export type ParsedTerm = { term: string; definition: string };
export type ParsedQA = { question: string; answer: string };
export type ParsedExercise = { title: string; prompt: string; hint?: string; solution: string; difficulty: number };
export type ParsedOption = { text: string; isCorrect: boolean };
export type ParsedQuestion = {
  type: QuestionTypeName;
  prompt: string;
  options: ParsedOption[];
  explanation?: string;
  acceptedAnswers: string[];
  numericAnswer?: number;
  numericTolerance?: number;
  matchingPairs?: { left: string; right: string }[];
  rubric: string[];
  modelAnswer?: string;
  points: number;
  difficulty: number;
};

export type ParsedLesson = {
  file: string;
  slug: string;
  meta: LessonFrontmatter;
  sections: ParsedSection[];
  terms: ParsedTerm[];
  qa: ParsedQA[];
  exercises: ParsedExercise[];
  questions: ParsedQuestion[];
};

export const curriculumSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: str,
    track: z.enum(TRACKS),
    subject: str,
    grade: z.number().int().min(1).max(12).optional(),
    gradeTo: z.number().int().min(1).max(12).optional(),
    variant: z.string().optional(),
    description: z.string().optional(),
    official: z.boolean().default(false),
    note: z.string().optional(),
    status: z.enum(CONTENT_STATUSES).default("PENDING_REVIEW"),
    source: z.string().optional(),
    order: z.number().int().default(100),
    vocationalProfession: z.string().regex(/^\d{6}$/).optional(),
    drivingCategory: z.string().optional(),
    sections: z
      .array(
        z.object({
          title: str,
          topics: z.array(str).min(1),
        }),
      )
      .min(1),
  })
  .strict()
  .refine((c) => c.gradeTo === undefined || (c.grade !== undefined && c.gradeTo > c.grade), {
    message: "gradeTo изисква grade и трябва да е по-голям от него",
    path: ["gradeTo"],
  });
export type CurriculumFile = z.infer<typeof curriculumSchema>;

export const subjectSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: str,
    shortName: z.string().optional(),
    category: z.enum([
      "LANGUAGE_LITERATURE",
      "MATHEMATICS",
      "FOREIGN_LANGUAGE",
      "SCIENCE",
      "SOCIAL",
      "ARTS",
      "TECHNOLOGY",
      "SPORT",
      "VOCATIONAL",
      "UNIVERSITY",
      "DRIVING",
      "FIRST_AID",
    ]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    icon: z.string(),
    description: z.string().optional(),
    order: z.number().int().default(100),
  })
  .strict();

export const sourceSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9-]+$/),
    title: str,
    organization: str,
    url: z.string().url(),
    type: z.enum([
      "OFFICIAL_CURRICULUM",
      "EDUCATION_STANDARD",
      "EXAM_MATERIAL",
      "UNIVERSITY_PAGE",
      "ADMISSION_GUIDE",
      "LEGISLATION",
      "DRIVING_OFFICIAL",
      "FIRST_AID_OFFICIAL",
      "REGISTER",
      "REFERENCE",
      "OTHER",
    ]),
    note: z.string().optional(),
    relatedTo: z.string().optional(),
    /** дата (YYYY-MM-DD), на която адресът е проверен ръчно или автоматично */
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** лиценз на материала, напр. „Обществено достояние“ или „CC BY-SA 4.0“ */
    license: z.string().optional(),
    licenseUrl: z.string().url().optional(),
  })
  .strict();
export type SourceFile = z.infer<typeof sourceSchema>;
