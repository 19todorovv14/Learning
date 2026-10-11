import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRolePage } from "@/lib/auth/guards";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import type { ContentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Уроци · Админ" };
const STATUSES: ContentStatus[] = ["DRAFT", "AI_GENERATED", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "OUTDATED"];

export default async function AdminLessons({ searchParams }: PageProps<"/admin/lessons">) {
  await requireRolePage("TEACHER", "/admin/lessons");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const subject = typeof sp.subject === "string" ? sp.subject : "";
  const [lessons, subjects] = await Promise.all([
    db.lesson.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { slug: { contains: q } }] } : {}),
        ...(subject ? { subject: { slug: subject } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      include: { subject: { select: { name: true } }, curriculumVersion: { select: { title: true } }, _count: { select: { questions: true, reports: { where: { resolvedAt: null } } } } },
    }),
    db.subject.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
  ]);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Уроци</h1>
        <Link href="/admin/lessons/new" className="btn-primary">
          + Нов урок
        </Link>
      </div>
      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px_200px_auto]">
        <input name="q" defaultValue={q} className="input" placeholder="Заглавие или slug" aria-label="Търсене" />
        <select name="subject" defaultValue={subject} className="input" aria-label="Предмет">
          <option value="">Всички предмети</option>
          {subjects.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className="input" aria-label="Статус">
          <option value="">Всички статуси</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn-secondary">Филтрирай</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-text-2">
            <tr>
              <th className="px-4 py-2.5 font-medium">Урок</th>
              <th className="px-4 py-2.5 font-medium">Курс</th>
              <th className="px-4 py-2.5 font-medium">Статус</th>
              <th className="px-4 py-2.5 font-medium">Въпроси</th>
              <th className="px-4 py-2.5 font-medium">Обновен</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lessons.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/lessons/${l.id}`} className="font-medium text-primary hover:underline">
                    {l.title}
                  </Link>
                  <div className="font-mono text-xs text-muted">{l.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-text-2">{l.curriculumVersion.title}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={l.status} />
                  {l._count.reports > 0 && <span className="badge ml-1 bg-danger-soft text-danger">{l._count.reports} сигнала</span>}
                </td>
                <td className="px-4 py-2.5">{l._count.questions}</td>
                <td className="px-4 py-2.5 text-muted">{formatDate(l.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
