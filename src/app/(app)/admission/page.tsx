import type { Metadata } from "next";
import Link from "next/link";
import { CheckSquare, ExternalLink, GraduationCap, Search, Target } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/misc";
import type { Degree } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Кандидатстване" };

const DEGREE: Record<string, string> = { PROFESSIONAL_BACHELOR: "Проф. бакалавър", BACHELOR: "Бакалавър", MASTER: "Магистър" };

export default async function AdmissionPage({ searchParams }: PageProps<"/admission">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const field = typeof sp.field === "string" ? sp.field : "";
  const city = typeof sp.city === "string" ? sp.city : "";
  const degreeParam = typeof sp.degree === "string" && sp.degree in DEGREE ? (sp.degree as Degree) : null;
  const user = await getCurrentUser();

  const [fields, cities, prepCourses, profile] = await Promise.all([
    db.program.groupBy({ by: ["professionalField"], where: { degree: { in: ["BACHELOR", "MASTER"] } }, _count: true, orderBy: { professionalField: "asc" } }),
    db.university.findMany({ distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }),
    db.curriculumVersion.findMany({
      where: { OR: [{ track: "ADMISSION" }, { variant: { in: ["ДЗИ", "Матура"] } }] },
      orderBy: [{ order: "asc" }, { title: "asc" }],
      include: { subject: { select: { name: true } }, _count: { select: { lessons: true } } },
    }),
    user
      ? db.userProfile.findUnique({ where: { userId: user.id }, include: { targetUniversity: { select: { name: true, slug: true, website: true } } } })
      : null,
  ]);

  const searching = !!(q || field || city || degreeParam);
  const results = searching
    ? await db.program.findMany({
        where: {
          degree: degreeParam ?? { in: ["BACHELOR", "PROFESSIONAL_BACHELOR"] },
          ...(degreeParam === "MASTER" ? {} : { NOT: { degreeDetail: "Магистър след висше образование" } }),
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          ...(field ? { professionalField: field } : {}),
          ...(city ? { university: { city } } : {}),
        },
        orderBy: [{ name: "asc" }],
        take: 100,
        include: { university: { select: { slug: true, name: true, shortName: true, city: true } }, faculty: { select: { name: true } } },
      })
    : [];
  // „Магистър след средно“ (напр. Медицина, Право) също е прием след 12. клас
  const masterAfterSecondary = searching && !degreeParam
    ? await db.program.findMany({
        where: {
          degreeDetail: "Магистър след средно образование",
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          ...(field ? { professionalField: field } : {}),
          ...(city ? { university: { city } } : {}),
        },
        take: 50,
        include: { university: { select: { slug: true, name: true, shortName: true, city: true } }, faculty: { select: { name: true } } },
      })
    : [];
  const all = [...masterAfterSecondary, ...results];

  return (
    <>
      <PageHeader
        kicker="Кандидат-студенти"
        title="Кандидатстване във висше училище"
        description="Намери специалност от официалния регистър на НАЦИД, провери условията на сайта на университета и се подготви за изпитите."
      />

      {profile?.targetUniversity && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-accent" />
            <div>
              <div className="text-xs text-muted">Твоята цел</div>
              <div className="font-medium">
                {profile.targetProgramText ? `${profile.targetProgramText} · ` : ""}
                {profile.targetUniversity.name}
                {profile.targetExamYear ? ` · ${profile.targetExamYear} г.` : ""}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/universities/${profile.targetUniversity.slug}${profile.targetProgramText ? `?q=${encodeURIComponent(profile.targetProgramText)}` : ""}`} className="btn-secondary">
              Специалностите
            </Link>
            {profile.targetUniversity.website && (
              <a href={profile.targetUniversity.website} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                Сайт <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      <section className="mb-10">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Search className="h-4.5 w-4.5" /> Намери специалност
        </h2>
        <form method="get" className="card grid gap-3 p-4 lg:grid-cols-[1fr_260px_180px_160px_auto]">
          <input name="q" defaultValue={q} className="input" placeholder="напр. Медицина, Информатика, Право…" aria-label="Специалност" />
          <select name="field" defaultValue={field} className="input" aria-label="Професионално направление">
            <option value="">Всички направления</option>
            {fields
              .filter((f) => f.professionalField)
              .map((f) => (
                <option key={f.professionalField} value={f.professionalField!}>
                  {f.professionalField}
                </option>
              ))}
          </select>
          <select name="city" defaultValue={city} className="input" aria-label="Град">
            <option value="">Всички градове</option>
            {cities.map((c) => (
              <option key={c.city}>{c.city}</option>
            ))}
          </select>
          <select name="degree" defaultValue={degreeParam ?? ""} className="input" aria-label="Степен">
            <option value="">След 12. клас</option>
            <option value="MASTER">Магистър</option>
          </select>
          <button className="btn-primary">Търси</button>
        </form>

        {searching && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted">
              Намерени: {all.length}
              {all.length >= 100 ? "+ (уточни търсенето)" : ""}
            </p>
            <ul className="card divide-y divide-border">
              {all.map((p) => (
                <li key={p.id}>
                  <Link href={`/universities/${p.university.slug}?q=${encodeURIComponent(p.name)}`} className="grid gap-1 px-4 py-3 hover:bg-surface-2 sm:grid-cols-[1fr_auto]">
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">
                        {p.university.name} · {p.university.city}
                        {p.faculty ? ` · ${p.faculty.name}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted sm:text-right">
                      {p.degreeDetail ?? DEGREE[p.degree]}
                      {p.durationYears ? ` · ${p.durationYears.toLocaleString("bg-BG")} г.` : ""}
                    </span>
                  </Link>
                </li>
              ))}
              {all.length === 0 && <li className="p-4 text-sm text-muted">Няма намерени специалности.</li>}
            </ul>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <GraduationCap className="h-4.5 w-4.5" /> Как работи приемът (общо)
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-text-2">
            <li>• Всяко висше училище определя условията за прием за всяка специалност и ги обявява в кандидатстудентски справочник или правила за прием.</li>
            <li>• Често се използват резултати от държавните зрелостни изпити (матурите), собствени приемни изпити и/или оценки от дипломата за средно образование.</li>
            <li>• За някои специалности (напр. изкуства, спорт, архитектура) има изпити за проверка на способностите.</li>
            <li>• Балът се образува по формула, определена от университета. Различните специалности в един университет може да имат различни формули.</li>
            <li>• Сроковете и таксите се променят всяка година.</li>
          </ul>
          <Alert kind="warning" className="mt-4">
            Не използвай миналогодишни изисквания като актуални. Провери текущата година на официалния сайт.
          </Alert>
        </section>
        <section className="card p-6">
          <h2 className="section-title flex items-center gap-2">
            <CheckSquare className="h-4.5 w-4.5" /> Какво да провериш на сайта на университета
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-text-2">
            <li>Кои изпити или оценки се зачитат за избраната специалност.</li>
            <li>Формулата за бал (кои оценки се умножават по какъв коефициент).</li>
            <li>Датите за кандидатстване, изпитите и класиранията.</li>
            <li>Дали може да се ползват резултати от матура вместо приемен изпит.</li>
            <li>Броя места и таксите (държавна поръчка / платено обучение).</li>
            <li>Изискванията за документи и как се подават (онлайн или на място).</li>
          </ol>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="section-title mb-3">Подготовка за изпитите</h2>
        {prepCourses.length === 0 ? (
          <p className="text-sm text-muted">Курсовете за подготовка се добавят.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prepCourses.map((c) => (
              <Link key={c.id} href={`/courses/${c.slug}`} className="card group p-4 hover:shadow-pop">
                <div className="font-medium group-hover:text-primary">{c.title}</div>
                <div className="text-xs text-muted">
                  {c.subject.name} · {c._count.lessons} урока
                </div>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-muted">
          Можеш да помолиш <Link href="/tutor" className="text-primary underline">AI учителя</Link> да ти направи план за подготовка до датата на изпита.
        </p>
      </section>
    </>
  );
}
