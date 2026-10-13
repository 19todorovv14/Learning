import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { getLibraryLessons, getSubjects } from "@/lib/data/learning";
import { PageHeader } from "@/components/ui/page-header";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Уроци" };

export default async function LessonsLibrary({ searchParams }: PageProps<"/lessons">) {
  const sp = await searchParams;
  const subject = typeof sp.subject === "string" ? sp.subject : undefined;
  const gradeRaw = typeof sp.grade === "string" ? Number(sp.grade) : NaN;
  const grade = gradeRaw >= 1 && gradeRaw <= 12 ? gradeRaw : undefined;
  const page = typeof sp.page === "string" ? Math.max(1, Number(sp.page) || 1) : 1;
  const [subjects, data] = await Promise.all([getSubjects(), getLibraryLessons({ subject, grade, page })]);

  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { subject, grade, page: undefined as number | undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") p.set(k, String(v));
    const s = p.toString();
    return s ? `/lessons?${s}` : "/lessons";
  };

  return (
    <>
      <PageHeader kicker="Библиотека" title="Уроци" description={`${data.total} урока — непроверените от редактор са отбелязани. Филтрирай по предмет и клас.`} />
      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_180px_auto]" method="get">
        <select name="subject" defaultValue={subject ?? ""} className="input" aria-label="Предмет">
          <option value="">Всички предмети</option>
          {subjects
            .filter((s) => s._count.lessons > 0)
            .map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s._count.lessons})
              </option>
            ))}
        </select>
        <select name="grade" defaultValue={grade ?? ""} className="input" aria-label="Клас">
          <option value="">Всички класове</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
            <option key={g} value={g}>
              {g}. клас
            </option>
          ))}
        </select>
        <button className="btn-primary" type="submit">
          Покажи
        </button>
      </form>

      {data.items.length === 0 ? (
        <EmptyState title="Няма уроци по тези критерии">Опитай с друг предмет или клас — или попитай AI учителя.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((l) => (
            <Link key={l.slug} href={`/lessons/${l.slug}`} className="card group flex flex-col p-4 hover:shadow-pop">
              <div className="flex items-center gap-3">
                <SubjectIcon icon={l.subject.icon} color={l.subject.color} size="sm" />
                <div className="text-xs text-muted">
                  {l.subject.name}
                  {l.gradeId ? ` · ${l.gradeId}. клас` : ` · ${l.curriculumVersion.title}`}
                </div>
              </div>
              <div className="mt-3 font-medium group-hover:text-primary">{l.title}</div>
              {l.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{l.summary}</p>}
              <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted">
                <Clock className="h-3.5 w-3.5" /> {l.estimatedMinutes} мин
                {l.status !== "PUBLISHED" && l.status !== "VERIFIED" && <StatusBadge status={l.status} />}
              </div>
            </Link>
          ))}
        </div>
      )}

      {data.pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Страници">
          {data.page > 1 && (
            <Link className="btn-secondary" href={qs({ page: data.page - 1 })}>
              ← Предишна
            </Link>
          )}
          <span className="text-sm text-muted">
            Страница {data.page} от {data.pages}
          </span>
          {data.page < data.pages && (
            <Link className="btn-secondary" href={qs({ page: data.page + 1 })}>
              Следваща →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
