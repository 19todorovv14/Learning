import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGradeOverview } from "@/lib/data/learning";
import { PageHeader } from "@/components/ui/page-header";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { EmptyState } from "@/components/ui/misc";
import { plural } from "@/lib/utils";

function parseGrade(raw: string) {
  const g = Number(raw);
  return Number.isInteger(g) && g >= 1 && g <= 12 ? g : null;
}

export async function generateMetadata({ params }: PageProps<"/grades/[grade]">): Promise<Metadata> {
  const g = parseGrade((await params).grade);
  return { title: g ? `${g}. клас` : "Клас" };
}

const NOTE: Record<number, string> = {
  4: "В края на 4. клас има национално външно оценяване (НВО) по български език и литература и по математика.",
  7: "В края на 7. клас има НВО по български език и литература и по математика — важно за приема в гимназия.",
  10: "В края на 10. клас има НВО по БЕЛ и математика, а по желание — и по чужд език и дигитални компетентности.",
  12: "В 12. клас се полагат държавните зрелостни изпити (матури).",
};

export default async function GradePage({ params }: PageProps<"/grades/[grade]">) {
  const grade = parseGrade((await params).grade);
  if (!grade) notFound();
  const curricula = await getGradeOverview(grade);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/subjects", label: "Предмети" }, { label: `${grade}. клас` }]}
        kicker="Клас"
        title={`${grade}. клас`}
        description={NOTE[grade]}
        actions={
          <div className="flex gap-1">
            {grade > 1 && (
              <Link href={`/grades/${grade - 1}`} className="btn-secondary">
                ← {grade - 1}. клас
              </Link>
            )}
            {grade < 12 && (
              <Link href={`/grades/${grade + 1}`} className="btn-secondary">
                {grade + 1}. клас →
              </Link>
            )}
          </div>
        }
      />
      {curricula.length === 0 ? (
        <EmptyState title="Програмите за този клас предстои да бъдат добавени">
          Можеш да зададеш въпрос по всяка тема на AI учителя.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {curricula.map((c) => {
            const topics = c.sections.reduce((n, s) => n + s._count.topics, 0);
            return (
              <Link key={c.id} href={`/courses/${c.slug}`} className="card group flex gap-4 p-4 hover:shadow-pop">
                <SubjectIcon icon={c.subject.icon} color={c.subject.color} />
                <div className="min-w-0">
                  <div className="font-medium group-hover:text-primary">{c.subject.name}</div>
                  <div className="text-sm text-muted">{c.gradeTo || (c.variant && c.variant !== "ООП") ? c.title : `${grade}. клас`}</div>
                  <div className="mt-2 text-xs text-muted">
                    {plural(topics, "тема", "теми")} · {plural(c._count.lessons, "готов урок", "готови урока")}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
