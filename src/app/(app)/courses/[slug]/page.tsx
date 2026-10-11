import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, CircleDot, Clock, Info, Sparkles } from "lucide-react";
import { getCurriculumBySlug, TRACK_LABEL } from "@/lib/data/learning";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { ProgressBar } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { StartQuizButton } from "@/components/quiz/start-quiz-button";
import { plural } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const c = await getCurriculumBySlug((await params).slug);
  return { title: c?.title ?? "Курс", description: c?.description ?? undefined };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const user = await getCurrentUser();
  const isEditor = hasRole(user, "EDITOR");
  const course = await getCurriculumBySlug((await params).slug, isEditor);
  if (!course) notFound();

  const lessonIds = course.sections.flatMap((s) => s.topics.flatMap((t) => t.lessons.map((l) => l.lesson.id)));
  const uniqueLessonIds = [...new Set(lessonIds)];
  const progress = user
    ? await db.lessonProgress.findMany({
        where: { userId: user.id, lessonId: { in: uniqueLessonIds } },
        select: { lessonId: true, status: true, bestQuizPercent: true },
      })
    : [];
  const pMap = new Map(progress.map((p) => [p.lessonId, p]));
  const completed = progress.filter((p) => p.status === "COMPLETED").length;
  const totalTopics = course.sections.reduce((n, s) => n + s.topics.length, 0);
  const coveredTopics = course.sections.reduce((n, s) => n + s.topics.filter((t) => t.lessons.length > 0).length, 0);
  const questionCount = await db.question.count({ where: { curriculumVersionId: course.id, type: { not: "OPEN" } } });

  const crumbs = [
    { href: "/subjects", label: "Предмети" },
    { href: `/subjects/${course.subject.slug}`, label: course.subject.name },
    { label: course.title },
  ];

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        kicker={TRACK_LABEL[course.track]}
        title={
          <span className="flex items-center gap-3">
            <SubjectIcon icon={course.subject.icon} color={course.subject.color} />
            {course.title}
          </span>
        }
        description={course.description}
        actions={
          questionCount >= 5 ? (
            <StartQuizButton scope="CURRICULUM" curriculumId={course.id} label="Тест по целия курс" signedIn={!!user} />
          ) : undefined
        }
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {plural(coveredTopics, "тема", "теми")} с готови уроци от общо {totalTopics}
            </span>
            {user && uniqueLessonIds.length > 0 && (
              <span className="text-muted">
                Усвоени: {completed} от {uniqueLessonIds.length}
              </span>
            )}
          </div>
          <ProgressBar
            className="mt-3"
            value={user && uniqueLessonIds.length ? (completed / uniqueLessonIds.length) * 100 : totalTopics ? (coveredTopics / totalTopics) * 100 : 0}
            label="Напредък по курса"
          />
          <p className="mt-3 text-xs text-muted">
            {user
              ? "Урокът се брои за усвоен, когато решиш теста към него с поне 80% или го отбележиш като научен."
              : "Влез в профила си, за да следиш напредъка си."}
          </p>
        </div>
        <div className="card flex gap-3 p-5 text-sm text-text-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div>
            {course.isOfficialStructure ? "Структура по официалната учебна програма." : course.structureNote ?? "Ориентировъчна структура."}
            {course.source && (
              <a href={course.source.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-primary underline">
                {course.source.organization}: {course.source.title}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {course.sections.map((section, si) => (
          <section key={section.id} className="card overflow-hidden" aria-labelledby={`s-${section.id}`}>
            <div className="flex items-center gap-3 border-b border-border bg-surface-2/60 px-5 py-3.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-fg">{si + 1}</span>
              <h2 id={`s-${section.id}`} className="font-semibold">
                {section.title}
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {section.topics.map((topic) => (
                <li key={topic.id} className="px-5 py-3.5">
                  {topic.lessons.length > 0 ? (
                    <div className="space-y-2">
                      {topic.lessons.map(({ lesson }) => {
                        const p = pMap.get(lesson.id);
                        const Icon = p?.status === "COMPLETED" ? CheckCircle2 : p ? CircleDot : Circle;
                        return (
                          <Link key={lesson.id} href={`/lessons/${lesson.slug}`} className="group flex items-start gap-3">
                            <Icon
                              className={`mt-0.5 h-5 w-5 shrink-0 ${p?.status === "COMPLETED" ? "text-success" : p ? "text-primary" : "text-border-strong"}`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-text group-hover:text-primary">{lesson.title}</div>
                              {lesson.summary && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{lesson.summary}</p>}
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" /> {lesson.estimatedMinutes} мин
                                </span>
                                {lesson.status !== "PUBLISHED" && lesson.status !== "VERIFIED" && <StatusBadge status={lesson.status} />}
                                {p?.bestQuizPercent != null && <span>Тест: {Math.round(p.bestQuizPercent)}%</span>}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-text-2">
                        <Circle className="h-5 w-5 shrink-0 text-border" />
                        <span>{topic.title}</span>
                        <span className="badge bg-surface-3 text-muted">Урокът предстои</span>
                      </div>
                      <Link
                        href={`/tutor?topic=${encodeURIComponent(topic.title)}&course=${encodeURIComponent(course.slug)}`}
                        className="chip text-xs"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-accent" /> Обясни ми с AI
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
