import type { Metadata } from "next";
import Link from "next/link";
import { getSubjects, SUBJECT_CATEGORY_LABEL } from "@/lib/data/learning";
import { PageHeader } from "@/components/ui/page-header";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Всички предмети" };

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

export default async function SubjectsPage() {
  const subjects = await getSubjects();
  const groups = new Map<string, typeof subjects>();
  for (const s of subjects) {
    const list = groups.get(s.category) ?? [];
    list.push(s);
    groups.set(s.category, list);
  }

  return (
    <>
      <PageHeader
        kicker="Библиотека"
        title="Всички предмети"
        description="Избери клас или предмет. Всяка тема е обяснена на прост език, с записки за тетрадката и тест накрая."
      />

      <section aria-labelledby="by-grade" className="mb-10">
        <h2 id="by-grade" className="section-title mb-3">
          По класове
        </h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {GRADES.map((g) => (
            <Link
              key={g}
              href={`/grades/${g}`}
              className="card flex flex-col items-center justify-center py-4 transition-colors hover:border-primary hover:bg-primary-soft"
            >
              <span className="text-xl font-semibold text-text">{g}</span>
              <span className="text-xs text-muted">клас</span>
            </Link>
          ))}
        </div>
      </section>

      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat} className="mb-10" aria-labelledby={`cat-${cat}`}>
          <h2 id={`cat-${cat}`} className="section-title mb-3">
            {SUBJECT_CATEGORY_LABEL[cat] ?? cat}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => {
              const grades = [...new Set(s.curricula.map((c) => c.gradeId).filter(Boolean))].sort((a, b) => a! - b!);
              return (
                <Link key={s.id} href={`/subjects/${s.slug}`} className="card group flex gap-4 p-4 transition-shadow hover:shadow-pop">
                  <SubjectIcon icon={s.icon} color={s.color} />
                  <div className="min-w-0">
                    <div className="font-medium text-text group-hover:text-primary">{s.name}</div>
                    {s.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{s.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{plural(s._count.lessons, "урок", "урока")}</span>
                      {grades.length > 0 && (
                        <span>
                          {grades.length === 1 ? `${grades[0]}. клас` : `${grades[0]}.–${grades[grades.length - 1]}. клас`}
                        </span>
                      )}
                      {s.curricula.length > 0 && <span>{plural(s.curricula.length, "програма", "програми")}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
