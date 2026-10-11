import "server-only";
import { db } from "@/lib/db";
import { serializeLesson } from "@/lib/content/serialize";

export async function loadLessonSource(id: string) {
  const l = await db.lesson.findUnique({
    where: { id },
    include: {
      curriculumVersion: { select: { slug: true } },
      sections: { orderBy: { order: "asc" } },
      terms: { orderBy: { order: "asc" } },
      teacherQuestions: { orderBy: { order: "asc" } },
      exercises: { orderBy: { order: "asc" } },
      questions: { where: { externalKey: { not: null } }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      sources: { include: { source: { select: { key: true } } } },
      topics: { include: { topic: { include: { section: { include: { curriculumVersion: { select: { slug: true, id: true } } } } } } } },
    },
  });
  if (!l) return null;
  const primary = l.topics.find((t) => t.topic.section.curriculumVersion.id === l.curriculumVersionId) ?? l.topics[0];
  const also = l.topics.filter((t) => t !== primary).map((t) => `${t.topic.section.curriculumVersion.slug}|${t.topic.title}`);
  const md = serializeLesson({
    slug: l.slug,
    title: l.title,
    curriculumSlug: l.curriculumVersion.slug,
    topicTitle: primary?.topic.title ?? "",
    also,
    order: l.order,
    estimatedMinutes: l.estimatedMinutes,
    summary: l.summary,
    objectives: l.objectives,
    prerequisites: l.prerequisites,
    keywords: l.keywords,
    status: l.status,
    origin: l.origin,
    isDemo: l.isDemo,
    authorName: l.authorName,
    sourceKeys: l.sources.map((s) => s.source.key).filter((k): k is string => !!k),
    sections: l.sections,
    terms: l.terms,
    qa: l.teacherQuestions,
    exercises: l.exercises,
    questions: l.questions.map((q) => ({
      ...q,
      matchingPairs: (q.matchingPairs as { left: string; right: string }[] | null) ?? null,
    })),
  });
  return { lesson: l, md };
}
