import type { Metadata } from "next";
import Link from "next/link";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/ui/status-badge";
import { resolveReportAction, setLessonStatusAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Проверка · Админ" };

export default async function ReviewQueuePage() {
  await requireRolePage("EDITOR", "/admin/review");
  const [queue, reports, aiQuestions] = await Promise.all([
    db.lesson.findMany({
      where: { status: { in: ["PENDING_REVIEW", "AI_GENERATED"] } },
      orderBy: { updatedAt: "asc" },
      take: 100,
      include: { subject: { select: { name: true } }, curriculumVersion: { select: { title: true } } },
    }),
    db.contentReport.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "asc" }, include: { lesson: { select: { id: true, title: true, slug: true } } } }),
    db.question.count({ where: { origin: "AI_GENERATED" } }),
  ]);
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Проверка и сигнали</h1>
      <section className="mb-10">
        <h2 className="section-title mb-3">Сигнали от потребители ({reports.length})</h2>
        <div className="card divide-y divide-border">
          {reports.length === 0 && <p className="p-4 text-sm text-muted">Няма отворени сигнали.</p>}
          {reports.map((r) => (
            <div key={r.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_320px]">
              <div>
                <Link href={`/admin/lessons/${r.lesson.id}`} className="font-medium text-primary hover:underline">
                  {r.lesson.title}
                </Link>
                <p className="mt-1 whitespace-pre-wrap text-sm">{r.message}</p>
                <div className="text-xs text-muted">{formatDateTime(r.createdAt)}</div>
              </div>
              <form action={resolveReportAction} className="flex gap-2">
                <input type="hidden" name="id" value={r.id} />
                <input name="resolution" className="input py-2 text-sm" placeholder="Какво е направено" />
                <button className="btn-secondary shrink-0 py-2 text-sm">Затвори</button>
              </form>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="section-title mb-1">Уроци, които чакат проверка ({queue.length})</h2>
        <p className="mb-3 text-sm text-muted">
          Проверете фактите, източниците и тестовете. Одобрените уроци получават етикет „Проверено“. ({aiQuestions} въпроса в системата
          са генерирани от AI по заявка на потребители — те не влизат в официалните тестове към уроците.)
        </p>
        <div className="card divide-y divide-border">
          {queue.map((l) => (
            <div key={l.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
              <div>
                <Link href={`/admin/lessons/${l.id}`} className="font-medium text-primary hover:underline">
                  {l.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <StatusBadge status={l.status} /> {l.subject.name} · {l.curriculumVersion.title} · обновен {formatDateTime(l.updatedAt)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/lessons/${l.slug}`} target="_blank" className="btn-ghost py-2 text-sm">
                  Преглед
                </Link>
                <form action={setLessonStatusAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="status" value="VERIFIED" />
                  <input type="hidden" name="comment" value="Одобрено от опашката за проверка" />
                  <button className="btn-primary py-2 text-sm">Одобри</button>
                </form>
                <form action={setLessonStatusAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="status" value="DRAFT" />
                  <input type="hidden" name="comment" value="Върнато за доработка" />
                  <button className="btn-secondary py-2 text-sm">Върни</button>
                </form>
              </div>
            </div>
          ))}
          {queue.length === 0 && <p className="p-4 text-sm text-muted">Опашката е празна.</p>}
        </div>
      </section>
    </>
  );
}
