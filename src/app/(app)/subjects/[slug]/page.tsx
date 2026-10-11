import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSubjectBySlug, TRACK_LABEL } from "@/lib/data/learning";
import { PageHeader } from "@/components/ui/page-header";
import { SubjectIcon } from "@/components/learning/subject-icon";
import { EmptyState } from "@/components/ui/misc";
import { plural } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/subjects/[slug]">): Promise<Metadata> {
  const s = await getSubjectBySlug((await params).slug);
  return { title: s?.name ?? "Предмет" };
}

export default async function SubjectPage({ params }: PageProps<"/subjects/[slug]">) {
  const subject = await getSubjectBySlug((await params).slug);
  if (!subject) notFound();

  const byTrack = new Map<string, typeof subject.curricula>();
  for (const c of subject.curricula) {
    const l = byTrack.get(c.track) ?? [];
    l.push(c);
    byTrack.set(c.track, l);
  }

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/subjects", label: "Предмети" }, { label: subject.name }]}
        title={
          <span className="flex items-center gap-3">
            <SubjectIcon icon={subject.icon} color={subject.color} />
            {subject.name}
          </span>
        }
        description={subject.description}
      />

      {subject.curricula.length === 0 ? (
        <EmptyState title="Учебните програми по този предмет предстои да бъдат добавени">
          Междувременно можеш да питаш AI учителя за всяка тема.
        </EmptyState>
      ) : (
        [...byTrack.entries()].map(([track, list]) => (
          <section key={track} className="mb-8">
            {byTrack.size > 1 && <h2 className="section-title mb-3">{TRACK_LABEL[track as keyof typeof TRACK_LABEL]}</h2>}
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((c) => {
                const topics = c.sections.reduce((n, s) => n + s._count.topics, 0);
                return (
                  <Link key={c.id} href={`/courses/${c.slug}`} className="card group flex items-center gap-4 p-4 hover:shadow-pop">
                    {c.gradeId ? (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg font-semibold">
                        {c.gradeId}
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium group-hover:text-primary">{c.title}</div>
                      <div className="mt-1 text-sm text-muted">
                        {plural(topics, "тема", "теми")} · {plural(c._count.lessons, "готов урок", "готови урока")}
                        {c.variant ? ` · ${c.variant}` : ""}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </>
  );
}
