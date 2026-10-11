import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Info } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, Stat } from "@/components/ui/misc";
import { formatDate } from "@/lib/utils";
import type { Degree } from "@/generated/prisma/enums";

const DEGREE: Record<Degree, string> = {
  PROFESSIONAL_BACHELOR: "Професионален бакалавър",
  BACHELOR: "Бакалавър",
  MASTER: "Магистър",
  DOCTOR: "Доктор",
};

export async function generateMetadata({ params }: PageProps<"/universities/[slug]">): Promise<Metadata> {
  const u = await db.university.findUnique({ where: { slug: (await params).slug }, select: { name: true } });
  return { title: u?.name ?? "Висше училище" };
}

export default async function UniversityPage({ params, searchParams }: PageProps<"/universities/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const uni = await db.university.findUnique({
    where: { slug },
    include: { source: true, faculties: { orderBy: { name: "asc" } }, admissions: { orderBy: { admissionYear: "desc" }, include: { source: true } } },
  });
  if (!uni) notFound();
  const degree = (["PROFESSIONAL_BACHELOR", "BACHELOR", "MASTER", "DOCTOR"] as const).find((d) => d === sp.degree);
  const faculty = typeof sp.faculty === "string" ? sp.faculty : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const [programs, counts] = await Promise.all([
    db.program.findMany({
      where: {
        universityId: uni.id,
        degree: degree ?? { in: ["PROFESSIONAL_BACHELOR", "BACHELOR", "MASTER"] },
        ...(faculty ? { facultyId: faculty } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: [{ faculty: { name: "asc" } }, { name: "asc" }],
      include: { faculty: { select: { name: true } } },
      take: 400,
    }),
    db.program.groupBy({ by: ["degree"], where: { universityId: uni.id }, _count: true }),
  ]);
  const count = (d: Degree) => counts.find((c) => c.degree === d)?._count ?? 0;

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/universities", label: "Университети" }, { label: uni.shortName ?? uni.name }]}
        kicker={`${uni.city} · ${uni.ownership === "STATE" ? "държавно висше училище" : "частно висше училище"}`}
        title={uni.name}
        description={uni.nameEn ?? undefined}
        actions={
          uni.website ? (
            <a href={uni.website} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Официален сайт <ExternalLink className="h-4 w-4" />
            </a>
          ) : undefined
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Бакалавър" value={count("BACHELOR")} />
        <Stat label="Магистър" value={count("MASTER")} />
        <Stat label="Проф. бакалавър" value={count("PROFESSIONAL_BACHELOR")} />
        <Stat label="Докторски програми" value={count("DOCTOR")} />
      </div>

      <Alert kind="info" className="mb-6" title="Кандидатстване">
        Условията за прием (изпити, балообразуване, срокове) се определят всяка година от висшето училище. Не публикуваме
        непроверени изисквания — виж кандидатстудентската страница на{" "}
        {uni.website ? (
          <a href={uni.website} target="_blank" rel="noopener noreferrer" className="underline">
            официалния сайт
          </a>
        ) : (
          "официалния сайт"
        )}
        . За подготовка използвай курсовете в раздел{" "}
        <Link href="/admission" className="underline">
          Кандидатстване
        </Link>
        .
      </Alert>

      {uni.admissions.length > 0 && (
        <section className="mb-8 space-y-3">
          <h2 className="section-title">Проверена информация за прием</h2>
          {uni.admissions.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="font-medium">
                {a.title} ({a.admissionYear})
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-text-2">{a.body}</p>
              <div className="mt-2 text-xs text-muted">
                {a.source && (
                  <a href={a.source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Източник
                  </a>
                )}
                {a.verifiedAt ? ` · проверено на ${formatDate(a.verifiedAt)}` : " · непроверено"}
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">Специалности</h2>
        <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_220px_200px_auto]">
          <input name="q" defaultValue={q} className="input" placeholder="Търси специалност…" aria-label="Търсене на специалност" />
          <select name="faculty" defaultValue={faculty} className="input" aria-label="Факултет">
            <option value="">Всички факултети</option>
            {uni.faculties.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select name="degree" defaultValue={degree ?? ""} className="input" aria-label="Степен">
            <option value="">Бакалавър и магистър</option>
            {Object.entries(DEGREE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn-primary">Покажи</button>
        </form>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-text-2">
              <tr>
                <th className="px-4 py-2.5 font-medium">Специалност</th>
                <th className="px-4 py-2.5 font-medium">Степен</th>
                <th className="px-4 py-2.5 font-medium">Професионално направление</th>
                <th className="px-4 py-2.5 font-medium">Срок</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {programs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    Няма специалности по тези критерии.
                  </td>
                </tr>
              )}
              {programs.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted">
                      {p.faculty?.name}
                      {p.languages.length > 0 && p.languages.join(", ") !== "Български" ? ` · език: ${p.languages.join(", ")}` : ""}
                      {p.regulated ? " · регулирана професия" : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-text-2">
                    {DEGREE[p.degree]}
                    {p.degreeDetail && <div className="text-xs text-muted">{p.degreeDetail}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-text-2">{p.professionalField ?? "—"}</td>
                  <td className="px-4 py-2.5 text-text-2">{p.durationYears ? `${p.durationYears.toLocaleString("bg-BG")} г.` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Източник: {uni.source?.organization ?? "НАЦИД"} — регистър на висшите училища (изтеглено на{" "}
          {uni.source?.verifiedAt ? formatDate(uni.source.verifiedAt) : "—"}). Регистърът съдържа акредитираните специалности; не всяка
          специалност има прием всяка година.
        </p>
      </section>
    </>
  );
}
