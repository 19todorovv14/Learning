import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/auth/guards";
import { getMyCourses } from "@/lib/data/course-progress";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { SubjectIcon } from "@/components/learning/subject-icon";

export const metadata: Metadata = { title: "Моето обучение" };

export default async function MyLearningPage() {
  const user = await requireUserPage("/my-learning");
  const courses = await getMyCourses(user.id);
  return (
    <>
      <PageHeader
        title="Моето обучение"
        description="Твоите курсове и колко от уроците в тях си усвоил."
        actions={
          <>
            <Link href="/progress" className="btn-secondary">
              Отчет за напредъка
            </Link>
            <Link href="/onboarding" className="btn-ghost">
              Промени предметите
            </Link>
          </>
        }
      />
      {courses.length === 0 ? (
        <EmptyState title="Още нямаш курсове" action={<Link href="/subjects" className="btn-primary">Избери предмет</Link>}>
          Избери предмети при настройката на профила или разгледай всички предмети.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => {
            const pct = c.progress.total ? (c.progress.completed / c.progress.total) * 100 : 0;
            return (
              <Link key={c.id} href={`/courses/${c.slug}`} className="card group p-5 hover:shadow-pop">
                <div className="flex items-center gap-3">
                  <SubjectIcon icon={c.subject.icon} color={c.subject.color} />
                  <div className="min-w-0">
                    <div className="font-medium group-hover:text-primary">{c.title}</div>
                    <div className="text-xs text-muted">{c.subject.name}</div>
                  </div>
                </div>
                <ProgressBar value={pct} className="mt-4" label={`Напредък по ${c.title}`} />
                <div className="mt-2 flex justify-between text-xs text-muted">
                  <span>
                    Усвоени {c.progress.completed} от {c.progress.total} урока
                  </span>
                  {c.progress.started > 0 && <span>{c.progress.started} започнати</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
