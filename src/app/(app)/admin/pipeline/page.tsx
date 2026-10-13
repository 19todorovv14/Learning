import type { Metadata } from "next";
import Link from "next/link";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { aiConfig } from "@/lib/ai/config";
import { formatDateTime } from "@/lib/utils";
import { STAGE_LABEL } from "@/lib/pipeline/labels";
import { PROVIDERS } from "@/lib/pipeline/providers";
import { createPipelineItemAction, enqueueMissingTopicsAction, processPipelineNowAction } from "@/app/actions/pipeline";
import type { PipelineStage } from "@/generated/prisma/enums";
import { StageBadge } from "./stage-badge";

// „Обработи опашката сега“ изпълнява задачи в server action — до минута.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Pipeline за съдържание · Админ" };

const STAGES = Object.keys(STAGE_LABEL) as PipelineStage[];

export default async function PipelinePage({ searchParams }: PageProps<"/admin/pipeline">) {
  await requireRolePage("EDITOR", "/admin/pipeline");
  const sp = await searchParams;
  const stage = STAGES.find((s) => s === sp.stage);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);

  const [items, counts, queued, nextJob, topics, curricula] = await Promise.all([
    db.pipelineItem.findMany({
      where: stage ? { stage } : {},
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        topic: { include: { section: { include: { curriculumVersion: { select: { title: true, subject: { select: { name: true } } } } } } } },
        _count: { select: { documents: true } },
        checks: { select: { result: true } },
      },
    }),
    db.pipelineItem.groupBy({ by: ["stage"], _count: { _all: true } }),
    db.pipelineJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
    db.pipelineJob.findFirst({ where: { status: "QUEUED" }, orderBy: { runAfter: "asc" }, select: { runAfter: true } }),
    q
      ? db.curriculumTopic.findMany({
          where: { title: { contains: q, mode: "insensitive" } },
          take: 20,
          orderBy: { title: "asc" },
          select: {
            id: true,
            title: true,
            _count: { select: { lessons: true, pipelineItems: true } },
            section: { select: { curriculumVersion: { select: { title: true, subject: { select: { name: true } } } } } },
          },
        })
      : Promise.resolve([]),
    db.curriculumVersion.findMany({ where: { track: "SCHOOL" }, orderBy: [{ gradeId: "asc" }, { title: "asc" }], select: { id: true, title: true } }),
  ]);
  const count = (s: PipelineStage) => counts.find((c) => c.stage === s)?._count._all ?? 0;
  const ai = aiConfig();
  const flash = one("error")
    ? { cls: "bg-danger-soft text-danger", text: one("error") }
    : one("processed") !== null
      ? {
          cls: "bg-success-soft text-success",
          text: `Обработени задачи: ${one("processed")} (успешни ${one("ok")}, за повторен опит ${one("retry")}, неуспешни ${one("failed")}, чакат настройка ${one("blocked")})`,
        }
      : one("added") !== null
        ? { cls: "bg-success-soft text-success", text: `Добавени задачи: ${one("added")}` }
        : null;

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline за съдържание</h1>
        <form action={processPipelineNowAction}>
          <input type="hidden" name="back" value="/admin/pipeline" />
          <button className="btn-primary">Обработи опашката сега</button>
        </form>
      </div>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        Тема от програмата → откриване на източник → извличане на текста (с версия, дата и лиценз) → урок-чернова → автоматични проверки →
        редакторска проверка → публикуване. Нищо не се показва на учащите преди одобрение от редактор.
      </p>
      {flash && <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${flash.cls}`}>{flash.text}</div>}

      <section className="card mb-6 grid gap-3 p-4 text-sm md:grid-cols-3">
        <div>
          <div className="font-medium">Източници</div>
          {Object.values(PROVIDERS).map((p) => (
            <div key={p.key} className="text-muted">
              ✓ {p.label} — публичен API, лиценз от API при всяко извличане
            </div>
          ))}
          {!process.env.PIPELINE_CONTACT_EMAIL && (
            <div className="mt-1 text-warning">Задайте PIPELINE_CONTACT_EMAIL — контакт в User-Agent (изискване на Wikimedia).</div>
          )}
        </div>
        <div>
          <div className="font-medium">Генериране на уроци (Claude)</div>
          {ai.configured ? (
            <div className="text-muted">✓ Настроено · модел {ai.model} · месечен бюджет ${ai.monthlyBudgetUsd}</div>
          ) : (
            <div className="text-warning">
              ANTHROPIC_API_KEY липсва — откриването и извличането работят, генерирането чака („Чака настройка“). Урокът може да се напише и
              ръчно по извлечения източник.
            </div>
          )}
        </div>
        <div>
          <div className="font-medium">Опашка</div>
          <div className="text-muted">
            {queued} задачи чакат{nextJob ? ` · следваща: ${formatDateTime(nextJob.runAfter)}` : ""}
          </div>
          <div className="text-xs text-muted">
            Постоянен worker: <code>npm run pipeline -- work</code> · или планировчик към <code>/api/cron/pipeline</code>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="mb-2 font-medium">Добави тема от програмата</h2>
          <form method="get" className="flex gap-2">
            <input name="q" defaultValue={q} className="input py-2 text-sm" placeholder="Търси тема, напр. „покръстването“" aria-label="Търси тема" />
            <button className="btn-secondary py-2 text-sm">Търси</button>
          </form>
          {q && (
            <ul className="mt-3 divide-y divide-border text-sm">
              {topics.length === 0 && <li className="py-2 text-muted">Няма намерени теми.</li>}
              {topics.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate">{t.title}</div>
                    <div className="truncate text-xs text-muted">
                      {t.section.curriculumVersion.subject.name} · {t.section.curriculumVersion.title} · уроци: {t._count.lessons}
                    </div>
                  </div>
                  <form action={createPipelineItemAction}>
                    <input type="hidden" name="topicId" value={t.id} />
                    <button className="btn-secondary shrink-0 py-1.5 text-xs">Добави</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form action={createPipelineItemAction} className="card p-4">
          <h2 className="mb-2 font-medium">Свободно търсене</h2>
          <p className="mb-2 text-xs text-muted">Без тема — материалът се класифицира автоматично или остава в „Некласифицирани“.</p>
          <div className="flex gap-2">
            <input name="query" required minLength={3} className="input py-2 text-sm" placeholder="напр. Фотосинтеза" aria-label="Търсене" />
            <button className="btn-secondary py-2 text-sm">Добави</button>
          </div>
        </form>
        <form action={enqueueMissingTopicsAction} className="card p-4">
          <h2 className="mb-2 font-medium">Теми без урок от програма</h2>
          <select name="curriculumVersionId" className="input mb-2 py-2 text-sm" aria-label="Учебна програма">
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input name="limit" type="number" min={1} max={50} defaultValue={5} className="input w-24 py-2 text-sm" aria-label="Брой" />
            <button className="btn-secondary py-2 text-sm">Добави в опашката</button>
          </div>
        </form>
      </section>

      <nav className="mb-3 flex flex-wrap gap-2 text-sm" aria-label="Филтър по етап">
        <Link href="/admin/pipeline" className={`badge ${!stage ? "bg-primary text-white" : "bg-surface-3"}`}>
          Всички ({counts.reduce((a, c) => a + c._count._all, 0)})
        </Link>
        {STAGES.filter((s) => count(s) > 0).map((s) => (
          <Link key={s} href={`/admin/pipeline?stage=${s}`} className={`badge ${stage === s ? "bg-primary text-white" : "bg-surface-3"}`}>
            {STAGE_LABEL[s]} ({count(s)})
          </Link>
        ))}
      </nav>

      <div className="card divide-y divide-border">
        {items.length === 0 && <p className="p-4 text-sm text-muted">Няма задачи.</p>}
        {items.map((i) => {
          const fails = i.checks.filter((c) => c.result === "FAIL").length;
          const warns = i.checks.filter((c) => c.result === "WARN").length;
          const cv = i.topic?.section.curriculumVersion;
          return (
            <div key={i.id} className="grid gap-2 p-4 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <Link href={`/admin/pipeline/${i.id}`} className="font-medium text-primary hover:underline">
                  {i.topic?.title ?? i.query}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <StageBadge stage={i.stage} />
                  {cv ? cv.title : "без тема"} · източници: {i._count.documents}
                  {i.checks.length > 0 && ` · проверки: ${fails} FAIL, ${warns} WARN`} · {formatDateTime(i.updatedAt)}
                </div>
                {i.lastError && <p className="mt-1 break-words text-xs text-danger">{i.lastError}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
