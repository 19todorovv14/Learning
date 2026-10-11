import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Първа помощ и спасители" };

export default async function FirstAidPage() {
  const courses = await db.curriculumVersion.findMany({
    where: { track: "FIRST_AID" },
    orderBy: { order: "asc" },
    include: { subject: true, _count: { select: { lessons: true, questions: true } } },
  });
  return (
    <>
      <PageHeader
        kicker="Долекарска помощ и безопасност във водата"
        title="Първа помощ и спасители"
        description="Теоретична подготовка по първа помощ (вкл. за кандидат-шофьори) и за спасители на водни площи — по международните насоки за ресусцитация."
      />
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="card flex items-center gap-4 border-danger/30 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-danger-soft text-danger">
            <Phone className="h-6 w-6" />
          </span>
          <div>
            <div className="text-2xl font-semibold">112</div>
            <div className="text-sm text-muted">Единен европейски номер за спешна помощ — безплатен, от всеки телефон.</div>
          </div>
        </div>
        <Alert kind="warning" className="lg:col-span-2" title="Теорията не замества практическото обучение">
          Реанимация, превързване и спасяване във вода се учат с инструктор и манекен. Сертификатите (напр. за кандидат-шофьори или
          за спасители) се издават от оправомощени организации като Българския Червен кръст — след курс и изпит при тях.
        </Alert>
      </div>

      <section className="mb-10">
        <h2 className="section-title mb-3">Курсове</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-muted">Курсовете се добавят.</p>
        ) : (
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
        )}
      </section>

      <section className="card p-5">
        <h2 className="section-title">Официални източници</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <a href="https://www.redcross.bg/activities/firstaid" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              Български Червен кръст — обучение по първа помощ <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>
            <a href="https://cprguidelines.eu/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              Насоки за ресусцитация на Европейския съвет по ресусцитация (ERC) <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        </ul>
      </section>
    </>
  );
}
