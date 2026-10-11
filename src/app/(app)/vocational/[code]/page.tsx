import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/misc";

const ROMAN = ["", "I", "II", "III", "IV"];

export async function generateMetadata({ params }: PageProps<"/vocational/[code]">): Promise<Metadata> {
  const p = await db.vocationalProfession.findUnique({ where: { code: (await params).code }, select: { name: true } });
  return { title: p?.name ?? "Професия" };
}

export default async function ProfessionPage({ params }: PageProps<"/vocational/[code]">) {
  const { code } = await params;
  if (!/^\d{6}$/.test(code)) notFound();
  const p = await db.vocationalProfession.findUnique({
    where: { code },
    include: {
      area: true,
      specialties: { orderBy: { code: "asc" } },
      curricula: { include: { _count: { select: { lessons: true } } } },
    },
  });
  if (!p) notFound();
  const newCodes = [...new Set(p.specialties.map((s) => s.newProfessionCode).filter((x): x is string => !!x))];
  const [newProfessions, oldSpecialties] = await Promise.all([
    newCodes.length ? db.vocationalProfession.findMany({ where: { code: { in: newCodes } }, select: { code: true, name: true } }) : [],
    p.listVersion === "СППОО-2024"
      ? db.vocationalSpecialty.findMany({ where: { newProfessionCode: p.code }, include: { profession: { select: { name: true, code: true } } }, orderBy: { code: "asc" } })
      : [],
  ]);

  return (
    <>
      <PageHeader
        crumbs={[{ href: p.listVersion === "СППОО-2003" ? "/vocational?list=2003" : "/vocational", label: "Професионално обучение" }, { label: p.name }]}
        kicker={`${p.listVersion} · професия ${p.code}`}
        title={p.name}
        description={`Професионално направление ${p.area.code} „${p.area.name}“${p.area.fieldName ? ` · област „${p.area.fieldName}“` : ""}`}
        actions={
          <Link href={`/tutor?topic=${encodeURIComponent(`професия „${p.name}“`)}`} className="btn-secondary">
            <Sparkles className="h-4 w-4 text-accent" /> Питай AI за професията
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title">Основни данни</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Код</dt>
              <dd className="font-mono">{p.code}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Степени на професионална квалификация</dt>
              <dd>{p.qualificationLevels.length ? p.qualificationLevels.map((l) => ROMAN[l]).join(", ") : "—"}</dd>
            </div>
            {p.regulated && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Регулирана професия</dt>
                <dd>да (в нормативен акт)</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-muted">
            Учебните планове и държавните образователни стандарти по професията се публикуват от МОН и НАПОО. Проверявай учебния
            план на своето училище.
          </p>
        </section>
        <section className="card p-5">
          <h2 className="section-title">Учебни курсове в BG LEARN</h2>
          {p.curricula.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Още нямаме курс, свързан директно с тази професия. Разгледай{" "}
              <Link href="/vocational" className="text-primary underline">
                общите професионални курсове
              </Link>{" "}
              или питай AI учителя за конкретна тема.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {p.curricula.map((c) => (
                <li key={c.id}>
                  <Link href={`/courses/${c.slug}`} className="text-primary hover:underline">
                    {c.title}
                  </Link>{" "}
                  <span className="text-xs text-muted">({c._count.lessons} урока)</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {p.specialties.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-3">Специалности</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-text-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Код</th>
                  <th className="px-4 py-2.5 font-medium">Специалност</th>
                  <th className="px-4 py-2.5 font-medium">Степен</th>
                  <th className="px-4 py-2.5 font-medium">Съответствие в СППОО-2024</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {p.specialties.map((s) => {
                  const np = newProfessions.find((x) => x.code === s.newProfessionCode);
                  return (
                    <tr key={s.code}>
                      <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
                      <td className="px-4 py-2.5">{s.name}</td>
                      <td className="px-4 py-2.5">{s.qualificationLevel ? ROMAN[s.qualificationLevel] : "—"}</td>
                      <td className="px-4 py-2.5">
                        {np ? (
                          <Link href={`/vocational/${np.code}`} className="text-primary hover:underline">
                            {np.code} {np.name}
                          </Link>
                        ) : (
                          <span className="text-muted">няма пряко съответствие</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {oldSpecialties.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title mb-3">Съответстващи специалности от стария списък (СППОО-2003)</h2>
          <ul className="card divide-y divide-border text-sm">
            {oldSpecialties.map((s) => (
              <li key={s.code} className="px-4 py-2.5">
                <span className="mr-2 font-mono text-xs text-muted">{s.code}</span>
                {s.name}{" "}
                <Link href={`/vocational/${s.profession.code}`} className="text-xs text-primary hover:underline">
                  ({s.profession.name})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Alert kind="info" className="mt-8">
        Данни от официалния Списък на професиите за ПОО ({p.listVersion}) и сравнителната таблица СППОО-2003 ↔ СППОО-2024 (НАПОО/МОН).
      </Alert>
    </>
  );
}
