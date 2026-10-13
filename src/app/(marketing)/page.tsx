import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  Car,
  CheckCircle2,
  GraduationCap,
  HeartPulse,
  Layers,
  NotebookPen,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { db } from "@/lib/db";
import { lessonStatusFilter } from "@/lib/data/learning";
import { plural } from "@/lib/utils";

const FAQ = [
  {
    q: "Безплатна ли е платформата?",
    a: "Да. Уроците, записките, тестовете и проследяването на прогреса са безплатни. AI учителят има дневен лимит, за да е достъпен за всички.",
  },
  {
    q: "Съдържанието по учебната програма ли е?",
    a: "Курсовете са подредени по предмети и класове, но структурата им е ориентировъчна — още не е сверена с официалните учебни програми на МОН. Уроците са допълнителни обяснителни материали, а не учебник. Всеки урок показва дали е проверен от преподавател и какви са източниците му (официални или справочни).",
  },
  {
    q: "Гарантирате ли отлична оценка?",
    a: "Не — оценката зависи от учителя, изпита и от теб. Даваме ти всичко, за да разбереш материала и да се подготвиш добре: обяснения, записки, въпроси от учителя и тестове.",
  },
  {
    q: "Шофьорските въпроси официалните ли са?",
    a: "Не. Тренировъчните ни въпроси са авторски и следват официалните изпитни теми на ИААА. Официалният изпит се провежда от ИААА — за актуални правила следи сайта на агенцията.",
  },
  {
    q: "Какво правите с личните ми данни?",
    a: "Събираме само необходимото за работата на платформата. Не продаваме данни и не показваме реклами. Можеш да изтеглиш или изтриеш всичките си данни от настройките.",
  },
  {
    q: "Подходяща ли е за деца?",
    a: "Да. За деца под 14 години е нужно съгласие на родител. Настройките по подразбиране са съобразени с непълнолетните, а AI учителят спазва правила за подходящо съдържание.",
  },
];

const FEATURES = [
  { Icon: BookOpenCheck, title: "Уроци на прост език", text: "Всяка тема в два режима: „Разбирам урока“ с примери и „Уча за училище“ с готови записки." },
  { Icon: NotebookPen, title: "Записки за тетрадката", text: "Подредени точно както ги диктува учителката — определения, формули, дати и примери." },
  { Icon: Sparkles, title: "Личен AI учител", text: "Обяснява по-просто, дава примери, изпитва те устно и прави тестове по твоята тема." },
  { Icon: Target, title: "Тестове с обяснения", text: "Упражнение или изпит с време. Виждаш защо грешиш и кои уроци да преговориш." },
  { Icon: Layers, title: "Умен преговор", text: "Интервално повторение: картите се появяват точно когато започваш да ги забравяш." },
  { Icon: Brain, title: "Твоят прогрес", text: "Ясни правила, без измислени проценти: научени уроци, време, резултати и слаби теми." },
];

const PATHS = [
  { href: "/subjects", Icon: GraduationCap, title: "1.–12. клас", text: "Предмети, НВО и матури — уроците се добавят постепенно" },
  { href: "/admission", Icon: Target, title: "Кандидат-студенти", text: "Висши училища и специалности от регистъра на НАЦИД" },
  { href: "/vocational", Icon: Wrench, title: "Професионално обучение", text: "Официалният списък на професиите" },
  { href: "/driving", Icon: Car, title: "Шофьорски изпит", text: "Теория по официалните теми на ИААА" },
  { href: "/first-aid", Icon: HeartPulse, title: "Първа помощ и спасители", text: "Реанимация, травми, безопасност във водата" },
];

export default async function HomePage() {
  const [lessons, verifiedLessons, questions, programs, demo] = await Promise.all([
    db.lesson.count({ where: { status: lessonStatusFilter() } }),
    db.lesson.count({ where: { status: { in: ["VERIFIED", "PUBLISHED"] } } }),
    db.question.count({ where: { lesson: { status: lessonStatusFilter() }, origin: { not: "AI_GENERATED" } } }),
    db.program.count(),
    db.lesson.findFirst({ where: { isDemo: true, status: lessonStatusFilter() }, orderBy: { createdAt: "asc" }, select: { slug: true, title: true, summary: true, gradeId: true, subject: { select: { name: true } } } }),
  ]);

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-20">
          <div className="max-w-3xl">
            <span className="badge bg-accent-soft text-accent">За ученици, студенти и всички, които учат</span>
            <h1 className="mt-5 font-serif text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-[60px]">
              Разбери всичко, което учиш.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-2">
              От първия училищен урок до университета и професионалните изпити — ясни обяснения, записки, тестове и личен AI
              учител на едно място.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3 text-base">
                Започни безплатно <ArrowRight className="h-4 w-4" />
              </Link>
              {demo && (
                <Link href={`/lessons/${demo.slug}`} className="btn-secondary px-6 py-3 text-base">
                  Виж примерен урок
                </Link>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> {plural(lessons, "урок", "урока")} ({verifiedLessons} проверени от редактор) и {plural(questions, "въпрос", "въпроса")}</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> {programs.toLocaleString("bg-BG")} специалности от регистъра на НАЦИД</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Работи на телефон</li>
            </ul>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-40 top-10 hidden h-[520px] w-[520px] rounded-full bg-primary-soft blur-3xl lg:block" aria-hidden />
      </section>

      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-3 px-5 py-10 sm:grid-cols-2 lg:grid-cols-5">
          {PATHS.map((p) => (
            <Link key={p.href} href={p.href} className="group rounded-2xl border border-border p-4 transition-colors hover:border-primary hover:bg-primary-soft">
              <p.Icon className="h-6 w-6 text-primary" />
              <div className="mt-3 font-medium group-hover:text-primary">{p.title}</div>
              <div className="text-sm text-muted">{p.text}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="max-w-2xl font-serif text-3xl font-semibold tracking-tight">Не 15 страници за една тема. Две — и ясни.</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Опростяваме езика, не знанията. Важните определения, дати, формули и процеси остават — просто са обяснени разбираемо.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <f.Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {demo && (
        <section className="mx-auto max-w-6xl px-5 pb-16">
          <div className="card grid gap-6 overflow-hidden p-0 md:grid-cols-2">
            <div className="p-8">
              <div className="kicker">Демонстрационен урок</div>
              <h3 className="mt-2 font-serif text-2xl font-semibold">{demo.title}</h3>
              <p className="mt-1 text-sm text-muted">
                {demo.subject.name}
                {demo.gradeId ? ` · ${demo.gradeId}. клас` : ""}
              </p>
              {demo.summary && <p className="mt-4 text-text-2">{demo.summary}</p>}
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href={`/lessons/${demo.slug}`} className="btn-primary">Отвори урока</Link>
                <Link href={`/lessons/${demo.slug}?mode=learn`} className="btn-secondary">Виж записките</Link>
              </div>
            </div>
            <div className="notebook m-6 hidden md:block" aria-hidden>
              <div className="prose-lesson text-[15px]">
                <p><strong>Квадрат на сбор</strong></p>
                <p>(a + b)² = a² + 2ab + b²</p>
                <p><strong>Разлика на квадрати</strong></p>
                <p>(a − b)(a + b) = a² − b²</p>
                <p className="text-danger">Внимавай: (a + b)² ≠ a² + b²</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section id="faq" className="mx-auto max-w-3xl px-5 pb-20">
        <h2 className="font-serif text-3xl font-semibold tracking-tight">Често задавани въпроси</h2>
        <div className="mt-6 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-0">
              <summary className="cursor-pointer list-none px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">{f.q}</summary>
              <p className="border-t border-border px-5 py-4 text-sm leading-relaxed text-text-2">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Създай безплатен профил
          </Link>
        </div>
      </section>
    </>
  );
}
