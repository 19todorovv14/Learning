import "server-only";
import { db } from "@/lib/db";
import { learnerStatuses } from "@/lib/data/visibility";
import { parseSearchQuery, toPrefixTsQuery, type ParsedQuery } from "./parse";

export type LessonHit = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  gradeId: number | null;
  subject: string;
  icon: string;
  color: string;
  rank: number;
};

async function searchLessons(p: ParsedQuery, useSubject: boolean, useGrade: boolean): Promise<LessonHit[]> {
  const tsq = toPrefixTsQuery(p.terms);
  if (!tsq && p.raw.length < 3) return [];
  const statuses = learnerStatuses();
  const subject = useSubject ? p.subjectSlug : null;
  const grade = useGrade ? p.grade : null;
  const titleQuery = p.terms.join(" ") || p.raw;
  return db.$queryRaw<LessonHit[]>`
    SELECT l.id, l.slug, l.title, l.summary, l."gradeId", s.name AS subject, s.icon, s.color,
      (
        CASE WHEN ${tsq} <> '' THEN ts_rank(to_tsvector('simple', coalesce(l.title,'') || ' ' || coalesce(l.summary,'') || ' ' || bgl_join_text(l.keywords)), to_tsquery('simple', ${tsq})) * 3 ELSE 0 END
        + similarity(lower(l.title), lower(${titleQuery})) * 2
        + CASE WHEN ${tsq} <> '' THEN coalesce((SELECT max(ts_rank(to_tsvector('simple', ls.body), to_tsquery('simple', ${tsq}))) FROM "LessonSection" ls WHERE ls."lessonId" = l.id), 0) ELSE 0 END
      )::float AS rank
    FROM "Lesson" l
    JOIN "Subject" s ON s.id = l."subjectId"
    WHERE l.status::text = ANY(${statuses})
      AND (${grade}::int IS NULL OR l."gradeId" = ${grade}::int)
      AND (${subject}::text IS NULL OR s.slug = ${subject}::text)
      AND (
        (${tsq} <> '' AND to_tsvector('simple', coalesce(l.title,'') || ' ' || coalesce(l.summary,'') || ' ' || bgl_join_text(l.keywords)) @@ to_tsquery('simple', ${tsq}))
        OR (${tsq} <> '' AND EXISTS (SELECT 1 FROM "LessonSection" ls WHERE ls."lessonId" = l.id AND to_tsvector('simple', ls.body) @@ to_tsquery('simple', ${tsq})))
        OR similarity(lower(l.title), lower(${titleQuery})) > 0.25
      )
    ORDER BY rank DESC
    LIMIT 20
  `;
}

export async function globalSearch(raw: string) {
  const p = parseSearchQuery(raw);
  if (!p.raw) return null;

  let lessons = await searchLessons(p, true, true);
  let relaxed = false;
  if (!lessons.length && (p.subjectSlug || p.grade)) {
    lessons = await searchLessons(p, false, !!p.grade);
    if (!lessons.length) lessons = await searchLessons(p, false, false);
    relaxed = true;
  }

  const likeTerms = p.terms.filter((t) => t.length >= 3).slice(0, 4);
  const likeAny = (field: string) => likeTerms.map((t) => ({ [field]: { contains: t.length > 6 ? t.slice(0, -2) : t, mode: "insensitive" as const } }));

  const [terms, topics, universities, programs, professions] = await Promise.all([
    likeTerms.length
      ? db.lessonTerm.findMany({
          where: { OR: likeAny("term"), lesson: { status: { in: learnerStatuses() } } },
          take: 8,
          select: { id: true, term: true, definition: true, lesson: { select: { slug: true, title: true } } },
        })
      : [],
    likeTerms.length
      ? db.curriculumTopic.findMany({
          where: {
            OR: likeAny("title"),
            ...(p.grade ? { section: { curriculumVersion: { gradeId: p.grade } } } : {}),
          },
          take: 10,
          select: {
            id: true,
            title: true,
            lessons: { select: { lesson: { select: { slug: true } } }, take: 1 },
            section: { select: { curriculumVersion: { select: { slug: true, title: true } } } },
          },
        })
      : [],
    likeTerms.length
      ? db.university.findMany({
          where: { OR: [...likeAny("name"), ...likeAny("shortName"), ...likeAny("city")] },
          take: 5,
          select: { slug: true, name: true, city: true },
        })
      : [],
    likeTerms.length
      ? db.program.findMany({
          where: { AND: likeAny("name"), degree: { in: ["BACHELOR", "MASTER", "PROFESSIONAL_BACHELOR"] } },
          take: 8,
          orderBy: { name: "asc" },
          select: { id: true, name: true, degree: true, university: { select: { slug: true, shortName: true, name: true } } },
        })
      : [],
    likeTerms.length
      ? db.vocationalProfession.findMany({
          where: { OR: likeAny("name") },
          take: 6,
          select: { code: true, name: true, listVersion: true },
        })
      : [],
  ]);

  return { parsed: p, relaxed, lessons, terms, topics, universities, programs, professions };
}
