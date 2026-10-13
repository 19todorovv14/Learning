"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { robotsAllows } from "@/lib/robots";
import { ContentError, parseLessonFile } from "@/lib/content/parse-lesson";
import { saveParsedLesson, SaveLessonError } from "@/lib/content/save-lesson";
import { changeLessonStatus, LessonStatusError } from "@/lib/content/lesson-status";
import type { ContentStatus, Role } from "@/generated/prisma/enums";

export async function saveLessonSourceAction(_: unknown, fd: FormData) {
  // Преподавателите могат да пишат уроци като чернови или за проверка; публикуват редакторите.
  const user = await requireRole("TEACHER");
  const raw = String(fd.get("source") ?? "").replace(/\r\n/g, "\n");
  const note = String(fd.get("changeNote") ?? "").slice(0, 300) || undefined;
  if (raw.length > 400_000) return { ok: false, message: "Урокът е твърде дълъг." };
  try {
    const parsed = parseLessonFile("редактор", raw, "");
    if (!parsed.slug) return { ok: false, message: "Липсва slug в frontmatter." };
    // Само администратор може директно да публикува/проверява
    if (user.role === "TEACHER") {
      if (!["DRAFT", "PENDING_REVIEW"].includes(parsed.meta.status))
        return { ok: false, message: "Преподавателите могат да записват уроци със статус DRAFT или PENDING_REVIEW. Публикуването е от редактор." };
      const existing = await db.lesson.findUnique({ where: { slug: parsed.slug }, select: { status: true } });
      if (existing && ["VERIFIED", "PUBLISHED"].includes(existing.status))
        return { ok: false, message: "Проверените уроци се редактират от редактор." };
    }
    const result = await saveParsedLesson(db, parsed, raw, { source: "admin", actorId: user.id, changeNote: note });
    const lesson = await db.lesson.findUniqueOrThrow({ where: { slug: parsed.slug }, select: { id: true, slug: true } });
    await audit(user.id, `lesson.${result === "created" ? "create" : "update"}`, "Lesson", lesson.id, { slug: lesson.slug });
    revalidatePath(`/lessons/${lesson.slug}`);
    if (result === "created") redirect(`/admin/lessons/${lesson.id}?saved=1`);
    return { ok: true, message: "Урокът е записан като нова версия." };
  } catch (e) {
    if (e instanceof ContentError) return { ok: false, message: "Грешки във формата:", problems: e.problems };
    if (e instanceof SaveLessonError) return { ok: false, message: e.message };
    throw e;
  }
}

const STATUSES = ["DRAFT", "AI_GENERATED", "PENDING_REVIEW", "VERIFIED", "PUBLISHED", "OUTDATED"] as const;

export async function setLessonStatusAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = String(fd.get("id"));
  const to = z.enum(STATUSES).parse(fd.get("status"));
  const comment = String(fd.get("comment") ?? "").slice(0, 2000) || null;
  let lesson;
  try {
    lesson = await changeLessonStatus(db, user.id, id, to as ContentStatus, comment);
  } catch (e) {
    if (e instanceof LessonStatusError && e.pipelineItemId) redirect(`/admin/pipeline/${e.pipelineItemId}?blocked=1`);
    throw e;
  }
  await audit(user.id, "lesson.status", "Lesson", id, { from: lesson.status, to });
  revalidatePath("/admin/review");
  revalidatePath(`/admin/lessons/${id}`);
  revalidatePath(`/lessons/${lesson.slug}`);
}

export async function restoreRevisionAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const revId = String(fd.get("revisionId"));
  const rev = await db.lessonRevision.findUniqueOrThrow({ where: { id: revId }, include: { lesson: true } });
  const snap = rev.snapshot as { raw?: string };
  if (!snap.raw) redirect(`/admin/lessons/${rev.lessonId}?restore=unsupported`);
  const parsed = parseLessonFile("версия", snap.raw, rev.lesson.slug);
  await saveParsedLesson(db, parsed, snap.raw, { source: "admin", actorId: user.id, changeNote: `Възстановена версия ${rev.version}` });
  await audit(user.id, "lesson.restore", "Lesson", rev.lessonId, { version: rev.version });
  redirect(`/admin/lessons/${rev.lessonId}?restored=${rev.version}`);
}

export async function resolveReportAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = String(fd.get("id"));
  const resolution = String(fd.get("resolution") ?? "").slice(0, 1000) || "Прегледано";
  await db.contentReport.update({ where: { id }, data: { resolvedAt: new Date(), resolution } });
  await audit(user.id, "report.resolve", "ContentReport", id);
  revalidatePath("/admin/review");
}

export async function setUserRoleAction(fd: FormData) {
  const admin = await requireRole("ADMIN");
  const id = String(fd.get("id"));
  const role = z.enum(["STUDENT", "UNIVERSITY_STUDENT", "TEACHER", "EDITOR", "ADMIN"]).parse(fd.get("role")) as Role;
  if (id === admin.id) return; // не сменяме собствената си роля
  const before = await db.user.findUniqueOrThrow({ where: { id }, select: { role: true } });
  await db.user.update({ where: { id }, data: { role } });
  await db.session.deleteMany({ where: { userId: id } }); // новата роля важи след ново влизане
  await audit(admin.id, "user.role", "User", id, { from: before.role, to: role });
  revalidatePath("/admin/users");
}

export async function updateSourceAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = String(fd.get("id"));
  const freshness = z.enum(["UNVERIFIED", "CURRENT", "NEEDS_REVIEW", "OUTDATED"]).parse(fd.get("freshness"));
  const note = String(fd.get("note") ?? "").slice(0, 1000) || null;
  await db.source.update({
    where: { id },
    data: { freshness, verificationNote: note, ...(freshness === "CURRENT" ? { verifiedAt: new Date() } : {}) },
  });
  await audit(user.id, "source.update", "Source", id, { freshness });
  revalidatePath("/admin/sources");
}

/** Проверява дали адресите на източниците отговарят (HTTP статус). */
export async function checkSourcesAction() {
  const user = await requireRole("EDITOR");
  const sources = await db.source.findMany({ select: { id: true, url: true } });
  let skipped = 0;
  await Promise.all(
    sources.map(async (s) => {
      // Не проверяваме адреси, за които robots.txt забранява автоматичен достъп (напр. правно-информационни системи).
      if (!(await robotsAllows(s.url))) {
        skipped++;
        await db.source.update({
          where: { id: s.id },
          data: { verificationNote: "Автоматичната проверка е пропусната: robots.txt на сайта забранява автоматичен достъп. Проверете ръчно." },
        });
        return;
      }
      let status = 0;
      try {
        const res = await fetch(s.url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "BG-LEARN-LinkCheck/1.0" } });
        status = res.status;
      } catch {
        status = 0;
      }
      await db.source.update({
        where: { id: s.id },
        data: { lastHttpStatus: status, ...(status >= 400 || status === 0 ? { freshness: "NEEDS_REVIEW" } : {}) },
      });
    }),
  );
  await audit(user.id, "source.check", "Source", null, { count: sources.length, skippedByRobots: skipped });
  revalidatePath("/admin/sources");
}

export async function verifySchoolAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = String(fd.get("id"));
  const op = String(fd.get("op"));
  if (op === "verify") await db.school.update({ where: { id }, data: { verified: true } });
  else if (op === "delete") await db.school.delete({ where: { id } });
  await audit(user.id, `school.${op}`, "School", id);
  revalidatePath("/admin/schools");
}
