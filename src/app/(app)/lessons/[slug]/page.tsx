import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  ListChecks,
  NotebookPen,
  Target,
} from "lucide-react";
import { getLessonBySlug, getLessonNeighbours } from "@/lib/data/learning";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Markdown } from "@/components/markdown/markdown";
import { Breadcrumbs } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/misc";
import { StatusBadge, ORIGIN_LABEL } from "@/components/ui/status-badge";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { LessonActions } from "@/components/learning/lesson-actions";
import { LessonTracker } from "@/components/learning/lesson-tracker";
import { StartQuizButton } from "@/components/quiz/start-quiz-button";
import { LessonTutorPanel } from "@/components/tutor/lesson-tutor-panel";
import { ReportProblem } from "@/components/learning/report-problem";
import { formatDate, gradeLabel } from "@/lib/utils";
import type { LessonSectionKind } from "@/generated/prisma/enums";

type Mode = "understand" | "learn" | "practice";
const MODES: { id: Mode; label: string; short: string; Icon: typeof BookOpenText }[] = [
  { id: "understand", label: "Разбирам урока", short: "Разбирам", Icon: Lightbulb },
  { id: "learn", label: "Уча за училище", short: "Уча", Icon: NotebookPen },
  { id: "practice", label: "Упражнения и тест", short: "Упражнявам", Icon: ListChecks },
];

const UNDERSTAND_KINDS: LessonSectionKind[] = ["INTRO", "EXPLANATION", "EXAMPLES", "EXTRA", "SUMMARY"];

export async function generateMetadata({ params }: PageProps<"/lessons/[slug]">): Promise<Metadata> {
  const lesson = await getLessonBySlug((await params).slug);
  if (!lesson) return { title: "Урок" };
  return {
    title: `${lesson.title}${lesson.gradeId ? ` — ${lesson.gradeId}. клас` : ""}`,
    description: lesson.summary ?? undefined,
  };
}

export default async function LessonPage({ params, searchParams }: PageProps<"/lessons/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const isEditor = hasRole(user, "EDITOR");
  const lesson = await getLessonBySlug(slug, isEditor);
  if (!lesson) notFound();

  const mode: Mode = sp.mode === "learn" || sp.mode === "practice" ? sp.mode : "understand";
  const [neighbours, userState] = await Promise.all([
    getLessonNeighbours(lesson.curriculumVersionId, lesson.order, isEditor),
    user
      ? Promise.all([
          db.bookmark.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } }),
          db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } }),
          db.reviewState.count({ where: { userId: user.id, flashcard: { lessonId: lesson.id } } }),
        ])
      : null,
  ]);
  const [bookmark, progress, inReview] = userState ?? [null, null, 0];

  const byKind = (k: LessonSectionKind) => lesson.sections.filter((s) => s.kind === k);
  const understandSections = lesson.sections.filter((s) => UNDERSTAND_KINDS.includes(s.kind));
  const notes = byKind("NOTES");

  const crumbs = [
    { href: `/subjects/${lesson.subject.slug}`, label: lesson.subject.name },
    { href: `/courses/${lesson.curriculumVersion.slug}`, label: lesson.curriculumVersion.title },
    ...(lesson.section ? [{ label: lesson.section.title }] : []),
  ];

  const unverified = lesson.status === "PENDING_REVIEW" || lesson.status === "AI_GENERATED" || lesson.status === "DRAFT";

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
      <article className="min-w-0">
        <Breadcrumbs items={crumbs} />
        <header className="mb-6">
          <div className="flex items-start gap-4">
            <SubjectIcon icon={lesson.subject.icon} color={lesson.subject.color} size="lg" className="hidden sm:grid" />
            <div className="min-w-0">
              <h1 className="font-serif text-[28px] font-semibold leading-tight tracking-tight text-text sm:text-[34px]">
                {lesson.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                {lesson.gradeId && (
                  <span className="badge bg-primary-soft text-primary">
                    <GraduationCap className="h-3.5 w-3.5" /> {gradeLabel(lesson.gradeId)}
                  </span>
                )}
                <span className="badge bg-surface-3 text-text-2">
                  <Clock className="h-3.5 w-3.5" /> {lesson.estimatedMinutes} мин
                </span>
                <StatusBadge status={lesson.status} />
                {lesson.isDemo && <span className="badge bg-accent-soft text-accent">Демонстрационен урок</span>}
              </div>
            </div>
          </div>
          {lesson.summary && <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-text-2">{lesson.summary}</p>}
        </header>

        {unverified && (
          <Alert kind="warning" className="mb-6" title="Урокът още не е проверен от преподавател">
            Съдържанието е създадено с помощта на изкуствен интелект и очаква редакторска проверка. Сверявай фактите с
            учебника си. Ако забележиш грешка — съобщи ни от бутона „Съобщи за грешка“.
          </Alert>
        )}
        {lesson.status === "OUTDATED" && (
          <Alert kind="error" className="mb-6" title="Възможно е урокът да е остарял">
            Правилата или програмата може да са се променили. Провери в официалния източник.
          </Alert>
        )}

        {/* Режими */}
        <nav aria-label="Режим на урока" className="no-print sticky top-16 z-10 -mx-4 mb-8 border-b border-border bg-bg/90 px-4 backdrop-blur sm:mx-0 sm:px-0">
          <div className="flex gap-1 overflow-x-auto">
            {MODES.map((m) => {
              const active = m.id === mode;
              return (
                <Link
                  key={m.id}
                  href={`/lessons/${lesson.slug}${m.id === "understand" ? "" : `?mode=${m.id}`}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                    active ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  <m.Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{m.label}</span>
                  <span className="sm:hidden">{m.short}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {mode === "understand" && (
          <div className="space-y-10">
            {(lesson.objectives.length > 0 || lesson.prerequisites.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {lesson.objectives.length > 0 && (
                  <div className="card p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Target className="h-4 w-4 text-accent" /> Какво ще научиш
                    </div>
                    <ul className="space-y-1.5 text-sm text-text-2">
                      {lesson.objectives.map((o) => (
                        <li key={o} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {lesson.prerequisites.length > 0 && (
                  <div className="card p-5">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <BookOpenText className="h-4 w-4 text-info" /> Трябва да знаеш преди това
                    </div>
                    <ul className="space-y-1.5 text-sm text-text-2">
                      {lesson.prerequisites.map((o) => (
                        <li key={o} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {understandSections.map((s) => (
              <section key={s.id} id={`sec-${s.kind.toLowerCase()}`} aria-labelledby={`h-${s.id}`}>
                <h2 id={`h-${s.id}`} className="mb-4 text-xl font-semibold tracking-tight">
                  {s.title}
                </h2>
                <Markdown>{s.body}</Markdown>
              </section>
            ))}
            <div className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">Разбра ли урока?</div>
                <div className="text-sm text-muted">Премини към готовите записки за тетрадката и въпросите от учителя.</div>
              </div>
              <Link href={`/lessons/${lesson.slug}?mode=learn`} className="btn-primary" scroll={false}>
                <NotebookPen className="h-4 w-4" /> Уча за училище
              </Link>
            </div>
          </div>
        )}

        {mode === "learn" && (
          <div className="space-y-10">
            {notes.map((s) => (
              <section key={s.id} aria-labelledby={`h-${s.id}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 id={`h-${s.id}`} className="text-xl font-semibold tracking-tight">
                    Записки за тетрадката
                  </h2>
                  <span className="no-print text-xs text-muted">Препиши ги — така се запомнят по-добре.</span>
                </div>
                <div className="notebook">
                  <Markdown>{s.body}</Markdown>
                </div>
              </section>
            ))}

            {lesson.terms.length > 0 && (
              <section aria-labelledby="h-terms">
                <h2 id="h-terms" className="mb-4 text-xl font-semibold tracking-tight">
                  Определения
                </h2>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {lesson.terms.map((t) => (
                    <div key={t.id} className="card p-4">
                      <dt className="font-semibold text-primary">
                        <Markdown className="max-w-none text-[15px] [&_p]:inline">{t.term}</Markdown>
                      </dt>
                      <dd className="mt-1">
                        <Markdown className="max-w-none text-[15px] leading-relaxed">{t.definition}</Markdown>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {[...byKind("KEY_FACTS"), ...byKind("FORMULAS")].map((s) => (
              <section key={s.id} aria-labelledby={`h-${s.id}`}>
                <h2 id={`h-${s.id}`} className="mb-4 text-xl font-semibold tracking-tight">
                  {s.title}
                </h2>
                <div className="callout callout-remember">
                  <Markdown className="max-w-none">{s.body}</Markdown>
                </div>
              </section>
            ))}

            {lesson.teacherQuestions.length > 0 && (
              <section aria-labelledby="h-qa">
                <h2 id="h-qa" className="mb-1 text-xl font-semibold tracking-tight">
                  Въпроси, които учителят може да зададе
                </h2>
                <p className="mb-4 text-sm text-muted">Опитай да отговориш наум, преди да отвориш отговора.</p>
                <div className="space-y-2">
                  {lesson.teacherQuestions.map((q, i) => (
                    <details key={q.id} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 font-medium">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-3 text-xs">{i + 1}</span>
                        <Markdown className="max-w-none flex-1 text-[15px] font-medium [&_p]:inline">{q.question}</Markdown>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="border-t border-border px-4 pb-4 pl-13 pt-3">
                        <Markdown className="max-w-none text-[15px]">{q.answer}</Markdown>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {byKind("ORAL_EXAM_PLAN").map((s) => (
              <section key={s.id} aria-labelledby={`h-${s.id}`}>
                <h2 id={`h-${s.id}`} className="mb-4 text-xl font-semibold tracking-tight">
                  План за устен отговор
                </h2>
                <div className="card p-5">
                  <Markdown className="max-w-none">{s.body}</Markdown>
                </div>
              </section>
            ))}

            {byKind("COMMON_MISTAKES").map((s) => (
              <section key={s.id} aria-labelledby={`h-${s.id}`}>
                <h2 id={`h-${s.id}`} className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
                  <AlertTriangle className="h-5 w-5 text-danger" /> Чести грешки
                </h2>
                <div className="callout callout-warning">
                  <Markdown className="max-w-none">{s.body}</Markdown>
                </div>
              </section>
            ))}

            <div className="card flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">Провери се</div>
                <div className="text-sm text-muted">Реши упражненията и кратък тест, за да видиш дали си научил урока.</div>
              </div>
              <Link href={`/lessons/${lesson.slug}?mode=practice`} className="btn-primary" scroll={false}>
                <ListChecks className="h-4 w-4" /> Упражнения и тест
              </Link>
            </div>
          </div>
        )}

        {mode === "practice" && (
          <div className="space-y-10">
            {lesson.exercises.length > 0 && (
              <section aria-labelledby="h-ex">
                <h2 id="h-ex" className="mb-4 text-xl font-semibold tracking-tight">
                  Упражнения
                </h2>
                <div className="space-y-4">
                  {lesson.exercises.map((ex, i) => (
                    <div key={ex.id} className="card p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="kicker">Задача {i + 1}</span>
                        <span className="badge bg-surface-3 text-muted">
                          {ex.difficulty === 1 ? "лесна" : ex.difficulty === 3 ? "трудна" : "средна"}
                        </span>
                      </div>
                      <Markdown className="max-w-none">{ex.prompt}</Markdown>
                      <div className="mt-4 space-y-2">
                        {ex.hint && (
                          <details className="rounded-xl border border-border bg-surface-2 px-4 py-2.5">
                            <summary className="cursor-pointer text-sm font-medium text-info">Подсказка</summary>
                            <Markdown className="mt-2 max-w-none text-[15px]">{ex.hint}</Markdown>
                          </details>
                        )}
                        <details className="rounded-xl border border-border bg-surface-2 px-4 py-2.5">
                          <summary className="cursor-pointer text-sm font-medium text-success">Покажи решението</summary>
                          <Markdown className="mt-2 max-w-none text-[15px]">{ex.solution}</Markdown>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="h-quiz" className="card p-6">
              <h2 id="h-quiz" className="text-xl font-semibold tracking-tight">
                Тест към урока
              </h2>
              <p className="mt-1 text-sm text-muted">
                {lesson._count.questions} въпроса. В режим „Упражнение“ виждаш обяснение след всеки отговор, а в режим „Изпит“ —
                чак накрая.
              </p>
              {progress?.bestQuizPercent != null && (
                <p className="mt-2 text-sm">
                  Най-добър резултат: <strong>{Math.round(progress.bestQuizPercent)}%</strong>
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <StartQuizButton scope="LESSON" lessonId={lesson.id} mode="PRACTICE" label="Упражнение" signedIn={!!user} />
                <StartQuizButton
                  scope="LESSON"
                  lessonId={lesson.id}
                  mode="EXAM"
                  label="Изпит (с време)"
                  variant="secondary"
                  signedIn={!!user}
                />
              </div>
            </section>
          </div>
        )}

        {/* Източници и навигация */}
        <footer className="mt-12 space-y-6 border-t border-border pt-6">
          <div className="text-sm text-muted">
            <div className="font-medium text-text-2">За този урок</div>
            <p className="mt-1">
              {ORIGIN_LABEL[lesson.origin]} · версия {lesson.version} · обновен на {formatDate(lesson.updatedAt)}
              {lesson.authorName ? ` · автор: ${lesson.authorName}` : ""}
            </p>
            {lesson.sources.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {lesson.sources.map(({ source }) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {source.organization} — {source.title} <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="ml-1 text-xs">
                      {source.freshness === "CURRENT" && source.verifiedAt
                        ? `(проверен на ${formatDate(source.verifiedAt)})`
                        : "(линкът не е проверен)"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2">Няма посочен външен източник — проверявай важните факти в учебника.</p>
            )}
            <p className="mt-2">
              Обясненията са оригинални и не копират учебници. Използвай ги заедно с учебника, по който учиш.
            </p>
          </div>
          <div className="no-print grid gap-3 sm:grid-cols-2">
            {neighbours.prev ? (
              <Link href={`/lessons/${neighbours.prev.slug}`} className="card group flex items-center gap-3 p-4">
                <ChevronLeft className="h-5 w-5 text-muted" />
                <div className="min-w-0">
                  <div className="text-xs text-muted">Предишен урок</div>
                  <div className="truncate font-medium group-hover:text-primary">{neighbours.prev.title}</div>
                </div>
              </Link>
            ) : (
              <span />
            )}
            {neighbours.next && (
              <Link href={`/lessons/${neighbours.next.slug}`} className="card group flex items-center justify-end gap-3 p-4 text-right">
                <div className="min-w-0">
                  <div className="text-xs text-muted">Следващ урок</div>
                  <div className="truncate font-medium group-hover:text-primary">{neighbours.next.title}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted" />
              </Link>
            )}
          </div>
        </footer>
      </article>

      {/* Странична колона */}
      <aside className="no-print mt-10 lg:mt-0">
        <div className="space-y-4 lg:sticky lg:top-24">
          <LessonActions
            lessonId={lesson.id}
            lessonSlug={lesson.slug}
            signedIn={!!user}
            bookmarked={!!bookmark}
            completed={progress?.status === "COMPLETED"}
            inReview={inReview > 0}
            termCount={lesson.terms.length}
          />
          <LessonTutorPanel lessonId={lesson.id} lessonTitle={lesson.title} signedIn={!!user} />
          <ReportProblem lessonId={lesson.id} signedIn={!!user} />
        </div>
      </aside>

      {user && <LessonTracker lessonId={lesson.id} mode={mode} />}
    </div>
  );
}
