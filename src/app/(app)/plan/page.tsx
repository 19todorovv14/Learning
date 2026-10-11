import type { Metadata } from "next";
import { nowMs } from "@/lib/time";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ExamForm, PlanForm } from "@/components/plan/plan-forms";
import { deleteExamAction, deletePlanAction, togglePlanItemAction } from "@/app/actions/plan";
import { formatDate, formatShortDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Календар и план" };

export default async function PlanPage() {
  const user = await requireUserPage("/plan");
  const [exams, plans, subjects, courses] = await Promise.all([
    db.userExam.findMany({ where: { userId: user.id }, orderBy: { date: "asc" }, include: { subject: { select: { name: true } } } }),
    db.studyPlan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { order: "asc" }, include: { lesson: { select: { slug: true } } } } },
    }),
    db.subject.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.curriculumVersion.findMany({
      where: { lessons: { some: {} } },
      orderBy: [{ subject: { order: "asc" } }, { gradeId: "asc" }],
      select: { id: true, title: true },
    }),
  ]);
  const now = nowMs();

  return (
    <>
      <PageHeader title="Календар и план за учене" description="Добави контролни и изпити — ще ти напомним навреме. Създай план, който разпределя уроците до изпита." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="section-title">Изпити и контролни</h2>
          <ExamForm subjects={subjects} />
          <ul className="card divide-y divide-border">
            {exams.length === 0 && <li className="p-4 text-sm text-muted">Няма добавени изпити.</li>}
            {exams.map((e) => {
              const days = Math.ceil((e.date.getTime() - now) / 86400000);
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted">
                      {formatDate(e.date)}
                      {e.subject ? ` · ${e.subject.name}` : ""}
                      {days >= 0 ? ` · след ${days} дни` : " · минал"}
                    </div>
                  </div>
                  <form action={deleteExamAction}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="btn-ghost px-2 py-1 text-xs text-danger">Изтрий</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="space-y-4">
          <h2 className="section-title">Планове за учене</h2>
          <PlanForm courses={courses} />
          {plans.map((p) => {
            const done = p.items.filter((i) => i.doneAt).length;
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{p.title}</div>
                    <div className="text-xs text-muted">
                      {done}/{p.items.length} изпълнени{p.examDate ? ` · изпит: ${formatDate(p.examDate)}` : ""}
                    </div>
                  </div>
                  <form action={deletePlanAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-ghost px-2 py-1 text-xs text-danger">Изтрий</button>
                  </form>
                </div>
                <ul className="mt-3 space-y-1">
                  {p.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 text-sm">
                      <form action={togglePlanItemAction}>
                        <input type="hidden" name="id" value={i.id} />
                        <button aria-label={i.doneAt ? "Отбележи като неизпълнено" : "Отбележи като изпълнено"} className="grid place-items-center">
                          {i.doneAt ? <CheckCircle2 className="h-4.5 w-4.5 text-success" /> : <Circle className="h-4.5 w-4.5 text-border-strong" />}
                        </button>
                      </form>
                      {i.lesson ? (
                        <Link href={`/lessons/${i.lesson.slug}`} className={`flex-1 hover:text-primary ${i.doneAt ? "text-muted line-through" : ""}`}>
                          {i.title}
                        </Link>
                      ) : (
                        <span className={`flex-1 ${i.doneAt ? "text-muted line-through" : ""}`}>{i.title}</span>
                      )}
                      {i.dueDate && <span className="text-xs text-muted">{formatShortDate(i.dueDate)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
