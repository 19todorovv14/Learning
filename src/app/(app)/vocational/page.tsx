import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Професионално обучение" };

const ROMAN = ["", "I", "II", "III", "IV"];

export default async function VocationalPage({ searchParams }: PageProps<"/vocational">) {
  const sp = await searchParams;
  const list = sp.list === "2003" ? "СППОО-2003" : "СППОО-2024";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const [areas, courses, specialtyHits] = await Promise.all([
    db.vocationalArea.findMany({
      where: { listVersion: list },
      orderBy: { code: "asc" },
      include: {
        professions: {
          where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { startsWith: q } }, { specialties: { some: { name: { contains: q, mode: "insensitive" } } } }] } : {},
          orderBy: { code: "asc" },
          select: { code: true, name: true, qualificationLevels: true, regulated: true, _count: { select: { specialties: true, curricula: true } } },
        },
      },
    }),
    db.curriculumVersion.findMany({
      where: { track: "VOCATIONAL" },
      orderBy: { title: "asc" },
      include: { subject: true, _count: { select: { lessons: true } } },
    }),
    q && list === "СППОО-2003"
      ? db.vocationalSpecialty.count({ where: { name: { contains: q, mode: "insensitive" } } })
      : 0,
  ]);
  const shown = areas.filter((a) => a.professions.length > 0);
  const byField = new Map<string, typeof shown>();
  for (const a of shown) {
    const k = a.fieldName ?? a.fieldCode ?? "";
    byField.set(k, [...(byField.get(k) ?? []), a]);
  }

  return (
    <>
      <PageHeader
        kicker="Професионални гимназии и техникуми"
        title="Професионално обучение"
        description="Професии и специалности по официалния Списък на професиите за професионално образование и обучение (НАПОО/МОН) и учебни курсове по професионалните предмети."
      />

      {courses.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title mb-3">Курсове по професионални предмети</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Link key={c.id} href={`/courses/${c.slug}`} className="card group p-4 hover:shadow-pop">
                <div className="font-medium group-hover:text-primary">{c.title}</div>
                <div className="text-xs text-muted">
                  {c.subject.name} · {c._count.lessons} урока
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Списък на професиите</h2>
          <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-sm">
            <Link href={`/vocational${q ? `?q=${encodeURIComponent(q)}` : ""}`} className={`rounded-lg px-3 py-1.5 ${list === "СППОО-2024" ? "bg-primary-soft text-primary" : "text-muted"}`}>
              СППОО-2024 (нов)
            </Link>
            <Link href={`/vocational?list=2003${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-lg px-3 py-1.5 ${list === "СППОО-2003" ? "bg-primary-soft text-primary" : "text-muted"}`}>
              СППОО-2003 (стар)
            </Link>
          </div>
        </div>
        <Alert kind="info" className="mb-4">
          {list === "СППОО-2024"
            ? "Новият списък важи за учениците, приети в VIII клас от учебната 2026–2027 г., и за обучението на лица над 16 години от 1 януари 2026 г. Професиите са с 6-цифрен код; цифрите I–IV са степените на професионална квалификация."
            : "Старият списък (с 7-цифрени специалности) се отнася за учениците, приети преди учебната 2026–2027 г. Данните са извлечени автоматично от официалните PDF документи."}{" "}
          <a href="https://www.navet.government.bg/bg/spisak-na-profesiite-za-poo/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
            Източник: НАПОО <ExternalLink className="h-3 w-3" />
          </a>
        </Alert>
        <form method="get" className="mb-6 flex gap-2">
          {list === "СППОО-2003" && <input type="hidden" name="list" value="2003" />}
          <input name="q" defaultValue={q} className="input" placeholder="Търси професия, специалност или код…" aria-label="Търсене" />
          <button className="btn-primary">Търси</button>
        </form>
        {q && specialtyHits > 0 && <p className="mb-3 text-sm text-muted">Съвпадения и в {specialtyHits} специалности (виж в професиите по-долу).</p>}
        <div className="space-y-6">
          {[...byField.entries()].map(([fieldName, list]) => (
            <div key={fieldName}>
              {fieldName && <div className="kicker mb-2">{fieldName}</div>}
              <div className="space-y-3">
                {list.map((a) => (
                  <details key={a.id} className="card group" open={!!q}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="mr-2 font-mono text-xs text-muted">{a.code}</span>
                        <span className="font-medium">{a.name}</span>
                      </span>
                      <span className="text-xs text-muted">{a.professions.length} професии</span>
                    </summary>
                    <ul className="divide-y divide-border border-t border-border">
                      {a.professions.map((p) => (
                        <li key={p.code}>
                          <Link href={`/vocational/${p.code}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-surface-2">
                            <span>
                              <span className="mr-2 font-mono text-xs text-muted">{p.code}</span>
                              {p.name}
                              {p.regulated && <span className="badge ml-2 bg-warning-soft text-warning">регулирана</span>}
                            </span>
                            <span className="text-xs text-muted">
                              {p.qualificationLevels.length > 0 && `степен ${p.qualificationLevels.map((l) => ROMAN[l]).join(", ")}`}
                              {p._count.specialties > 0 && ` · ${p._count.specialties} спец.`}
                              {p._count.curricula > 0 && " · има курс"}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="text-sm text-muted">Няма съвпадения.</p>}
        </div>
      </section>
    </>
  );
}
