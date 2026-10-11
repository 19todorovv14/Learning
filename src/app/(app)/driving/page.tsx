import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Info } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/misc";
import { StartQuizButton } from "@/components/quiz/start-quiz-button";

export const metadata: Metadata = { title: "Шофьорски изпити" };

export default async function DrivingPage() {
  const user = await getCurrentUser();
  const [categories, courses, questionCount, topics, profile] = await Promise.all([
    db.drivingCategory.findMany({ orderBy: { order: "asc" } }),
    db.curriculumVersion.findMany({
      where: { track: "DRIVING" },
      orderBy: { order: "asc" },
      include: { _count: { select: { lessons: true, questions: true } } },
    }),
    db.drivingQuestion.count(),
    db.drivingTopic.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { questions: true } } } }),
    user ? db.userProfile.findUnique({ where: { userId: user.id }, select: { drivingCategoryCode: true } }) : null,
  ]);

  return (
    <>
      <PageHeader
        kicker="Правоспособност за управление на МПС"
        title="Шофьорски изпити"
        description="Теория по програмата „Безопасност на движението по пътищата“: знаци, предимство, маневри, скорост и поведение при опасност — с тренировъчни тестове и обяснения."
      />

      <Alert kind="warning" className="mb-6" title="Тренировъчни, а не официални въпроси">
        Въпросите в BG LEARN са авторски и следват официалните изпитни теми. Официалните изпитни въпроси се утвърждават и
        използват от Изпълнителна агенция „Автомобилна администрация“ (ИААА). Правилата и санкциите се променят — проверявай
        актуалния Закон за движението по пътищата.
      </Alert>

      <div className="mb-10 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="section-title">Как изглежда теоретичният изпит (категории B и B1)</h2>
          <ul className="mt-3 space-y-2 text-sm text-text-2">
            <li>• Изпитът е електронен тест с 45 въпроса с общо 97 точки.</li>
            <li>• Всеки въпрос има 2, 3 или 4 отговора, от които 1, 2 или 3 са верни, и носи 1, 2 или 3 точки.</li>
            <li>• Въпросът се зачита само ако си отбелязал <strong>всички</strong> верни отговори и нито един грешен.</li>
            <li>• Някои въпроси са с изображения, а за категориите с утвърдени такива — и два въпроса с интерактивни видеоклипове.</li>
            <li>
              • Минималният брой точки за успешен изпит се определя в методиката на ИААА (в публикувания проект от 2024 г. — 87
              точки). Провери актуалната версия.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <a href="https://www.rta.government.bg/upload/13306/Metodika_izpiti.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              Методика на ИААА (проект, 2024) <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://www.rta.government.bg/bg/archive_p_exam-themes-for-drivers-license" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              Официални изпитни теми <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://www.ciela.net/svobodna-zona-normativi/view/2134649345/zakon-za-dvizhenieto-po-patishtata" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              Закон за движението по пътищата <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>
        <section className="card flex flex-col p-5">
          <h2 className="section-title">Пробен тест</h2>
          <p className="mt-1 text-sm text-muted">
            {questionCount} тренировъчни въпроса в банката. Оценяване „всичко или нищо“ — както на изпита.
          </p>
          <div className="mt-auto flex flex-col gap-2 pt-4">
            <StartQuizButton scope="DRIVING" mode="EXAM" count={45} drivingCategory={profile?.drivingCategoryCode ?? undefined} label="Пробен изпит (до 45 въпроса)" signedIn={!!user} />
            <StartQuizButton scope="DRIVING" mode="PRACTICE" count={15} label="Бързо упражнение (15)" variant="secondary" signedIn={!!user} />
          </div>
        </section>
      </div>

      {courses.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title mb-3">Учебни курсове</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.slug}`} className="card group p-5 hover:shadow-pop">
                <div className="font-medium group-hover:text-primary">{c.title}</div>
                <div className="mt-1 text-sm text-muted">
                  {c._count.lessons} урока · {c._count.questions} въпроса
                </div>
                {c.description && <p className="mt-2 text-sm text-text-2">{c.description}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title mb-3">Раздели на програмата</h2>
          <ul className="card divide-y divide-border">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>{t.title}</span>
                <span className="text-xs text-muted">{t._count.questions} въпроса</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">Категории</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.code} className="card flex gap-4 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg font-semibold text-primary">{c.code}</span>
              <div>
                <div className="font-medium">{c.name}</div>
                <p className="mt-0.5 text-sm text-muted">{c.description}</p>
                {c.minAge && <p className="mt-1 text-xs text-muted">Минимална възраст по общото правило: {c.minAge} г.</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> По чл. 150а и следващите от ЗДвП. Има изключения (напр. за категория A при
          стаж с A2) — провери текста на закона.
        </p>
      </section>
    </>
  );
}
