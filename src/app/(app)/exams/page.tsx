import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, GraduationCap, RotateCcw, Target, TriangleAlert } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StartQuizButton } from "@/components/quiz/start-quiz-button";
import { curriculumQuestionsWhere } from "@/lib/quiz/attempts";
import { curriculumForGrade } from "@/lib/data/grade-filter";
import { formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Подготовка за изпити" };

/** Минимален брой въпроси, за да има смисъл от контролно/симулация. */
const MIN_QUESTIONS = 5;

type Course = { id: string; slug: string; title: string; description: string | null; questions: number; lessons: number; topics: number };

async function withCounts(list: { id: string; slug: string; title: string; description: string | null }[]): Promise<Course[]> {
  return Promise.all(
    list.map(async (c) => {
      const [questions, lessons, topics] = await Promise.all([
        db.question.count({ where: curriculumQuestionsWhere(c.id) }),
        db.topicLesson.count({ where: { topic: { section: { curriculumVersionId: c.id } }, lesson: { status: { not: "DRAFT" } } } }),
        db.curriculumTopic.count({ where: { section: { curriculumVersionId: c.id } } }),
      ]);
      return { ...c, questions, lessons, topics };
    }),
  );
}

function CourseCard({ c, examLabel }: { c: Course; examLabel: string }) {
  const enough = c.questions >= MIN_QUESTIONS;
  return (
    <div className="card flex flex-col p-5">
      <Link href={`/courses/${c.slug}`} className="font-semibold hover:text-primary">
        {c.title}
      </Link>
      <p className="mt-1 text-xs text-muted">
        {c.lessons} урока по {c.topics} теми · {c.questions} тренировъчни въпроса
      </p>
      {c.description && <p className="mt-2 line-clamp-2 text-sm text-text-2">{c.description}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {enough ? (
          <>
            <StartQuizButton scope="CURRICULUM" curriculumId={c.id} mode="EXAM" count={20} label={examLabel} signedIn />
            <StartQuizButton scope="CURRICULUM" curriculumId={c.id} mode="PRACTICE" count={15} label="Тренировка" variant="secondary" signedIn />
          </>
        ) : (
          <p className="text-xs text-muted">Още няма достатъчно въпроси (нужни са поне {MIN_QUESTIONS}) — уроците се добавят постепенно.</p>
        )}
      </div>
    </div>
  );
}

export default async function ExamsPage() {
  const user = await requireUserPage("/exams");
  const profile = await db.userProfile.findUnique({ where: { userId: user.id }, select: { grade: true } });
  const grade = profile?.grade ?? null;

  const [examCurricula, gradeCurricula, weak, wrongCount, recent] = await Promise.all([
    db.curriculumVersion.findMany({
      where: { track: "ADMISSION" },
      orderBy: [{ gradeId: "asc" }, { order: "asc" }],
      select: { id: true, slug: true, title: true, description: true, gradeId: true },
    }),
    grade
      ? db.curriculumVersion.findMany({
          where: { track: "SCHOOL", OR: curriculumForGrade(grade) },
          orderBy: [{ subject: { order: "asc" } }],
          select: { id: true, slug: true, title: true, description: true },
        })
      : Promise.resolve([]),
    db.lessonProgress.findMany({
      where: { userId: user.id, bestQuizPercent: { lt: 70 } },
      orderBy: { bestQuizPercent: "asc" },
      take: 8,
      select: { bestQuizPercent: true, lesson: { select: { id: true, slug: true, title: true } } },
    }),
    db.userQuestionState.count({ where: { userId: user.id, lastCorrect: false } }),
    db.assessmentAttempt.findMany({
      where: { userId: user.id, mode: "EXAM", submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: { id: true, title: true, percent: true, submittedLate: true },
    }),
  ]);
  const [national, admission, byGrade] = await Promise.all([
    withCounts(examCurricula.filter((c) => c.gradeId !== null)),
    withCounts(examCurricula.filter((c) => c.gradeId === null)),
    withCounts(gradeCurricula),
  ]);

  return (
    <>
      <PageHeader
        kicker="Изпити"
        title="Подготовка за изпити"
        description="Контролни по предмет, симулации с таймер, преговор на слабите теми и подготовка за НВО, ДЗИ и кандидатстване."
      />

      <div className="mb-8 flex gap-3 rounded-xl border border-warning bg-warning-soft p-4 text-sm" role="note">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p>
          Всички въпроси тук са <strong>тренировъчни</strong> — създадени за BG LEARN по темите на програмите. Те <strong>не са</strong>{" "}
          официални изпитни задачи. Официалните изпитни материали и формати се публикуват от МОН — проверявай актуалния формат за
          своята година на сайта на министерството.
        </p>
      </div>

      <section className="mb-10 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <RotateCcw className="h-4.5 w-4.5 text-danger" /> Слаби теми
          </div>
          {weak.length === 0 && wrongCount === 0 ? (
            <p className="mt-1 text-sm text-muted">Реши няколко теста — тук ще се появят темите, които трябва да преговориш.</p>
          ) : (
            <>
              <ul className="mt-2 space-y-1 text-sm">
                {weak.map((w) => (
                  <li key={w.lesson.id} className="flex items-center justify-between gap-2">
                    <Link href={`/lessons/${w.lesson.slug}`} className="truncate text-primary hover:underline">
                      {w.lesson.title}
                    </Link>
                    <span className="shrink-0 text-xs text-muted">най-добър резултат {formatPercent(w.bestQuizPercent ?? 0)}</span>
                  </li>
                ))}
              </ul>
              {wrongCount > 0 && (
                <div className="mt-3">
                  <StartQuizButton scope="MISTAKES" label={`Преговор на грешките (${wrongCount})`} signedIn />
                </div>
              )}
            </>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <ClipboardList className="h-4.5 w-4.5 text-primary" /> Последни симулации
          </div>
          {recent.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Още нямаш решени изпитни симулации.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <Link href={`/quiz/${a.id}/result`} className="truncate text-primary hover:underline">
                    {a.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {formatPercent(a.percent ?? 0)}
                    {a.submittedLate ? " · след края на времето" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Target className="h-5 w-5 text-accent" /> НВО и държавни зрелостни изпити
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {national.map((c) => (
            <CourseCard key={c.id} c={c} examLabel="Симулация с таймер" />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Още няма подготвителни курсове за НВО в IV и X клас и за ДЗИ по избор — вижте картата на покритието.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" /> Контролни и класни по предмети {grade ? `· ${grade}. клас` : ""}
        </h2>
        {!grade ? (
          <p className="text-sm text-muted">
            Изберете клас в <Link href="/onboarding" className="text-primary hover:underline">профила си</Link>, за да видите контролните за вашия клас.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {byGrade.map((c) => (
              <CourseCard key={c.id} c={c} examLabel="Контролно с таймер" />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title mb-3">Кандидатстудентски изпити</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {admission.map((c) => (
            <CourseCard key={c.id} c={c} examLabel="Пробен изпит" />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Условията за прием, изпитите и сроковете се определят от всяко висше училище —{" "}
          <Link href="/admission" className="text-primary hover:underline">
            виж кандидатстване
          </Link>{" "}
          и сайта на съответния университет.
        </p>
      </section>
    </>
  );
}
