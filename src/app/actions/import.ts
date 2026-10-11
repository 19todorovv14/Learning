"use server";

import { revalidatePath } from "next/cache";
import { join } from "node:path";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { importDocumentAsDraft, importLessons, importQuestionsCsv, importSchoolsCsv, type ImportSummary } from "@/lib/admin/import";
import { loadContent } from "@/lib/content/load";
import { importContent } from "@/lib/content/import";

const MAX = 10 * 1024 * 1024;

export type ImportState = (ImportSummary & { ok: boolean; lessonId?: string }) | null;

async function record(actorId: string, kind: string, filename: string | null, sum: ImportSummary) {
  await db.importJob.create({
    data: {
      createdById: actorId,
      kind,
      filename,
      status: sum.errors.length ? (sum.created + sum.updated ? "PARTIAL" : "FAILED") : "SUCCEEDED",
      summary: { created: sum.created, updated: sum.updated, skipped: sum.skipped, errors: sum.errors.slice(0, 50), notes: sum.notes },
    },
  });
  await audit(actorId, `import.${kind}`, "ImportJob", null, { filename, created: sum.created, updated: sum.updated, errors: sum.errors.length });
}

export async function importAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const user = await requireRole("EDITOR");
  const kind = String(fd.get("kind"));
  const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Избери файл."], notes: [] };
  if (files.some((f) => f.size > MAX)) return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Файлът е над 10 MB."], notes: [] };

  let sum: ImportSummary & { lessonId?: string };
  if (kind === "lessons") {
    if (files.some((f) => !/\.(md|json)$/i.test(f.name))) return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Само .md или .json файлове."], notes: [] };
    sum = await importLessons(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))), user.id);
  } else if (kind === "questions") {
    sum = await importQuestionsCsv(await files[0].text());
  } else if (kind === "schools") {
    sum = await importSchoolsCsv(await files[0].text());
  } else if (kind === "document") {
    const curriculum = String(fd.get("curriculum") ?? "");
    const topic = String(fd.get("topic") ?? "");
    if (!curriculum || !topic) return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Избери курс и тема."], notes: [] };
    sum = await importDocumentAsDraft(files[0], curriculum, topic, user.id);
  } else {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: ["Непознат вид импорт."], notes: [] };
  }
  await record(user.id, kind, files.map((f) => f.name).join(", ").slice(0, 300), sum);
  revalidatePath("/admin/import");
  return { ok: sum.errors.length === 0, ...sum };
}

/** Синхронизира съдържанието от папка content/ в хранилището. */
export async function syncRepositoryContentAction(): Promise<ImportState> {
  const user = await requireRole("ADMIN");
  const bundle = loadContent(join(process.cwd(), "content"));
  if (bundle.errors.length) {
    const sum = { created: 0, updated: 0, skipped: 0, errors: bundle.errors.slice(0, 50), notes: [] };
    await record(user.id, "repository", null, sum);
    return { ok: false, ...sum };
  }
  const r = await importContent(db, bundle);
  const sum = {
    created: r.lessonsCreated,
    updated: r.lessonsUpdated,
    skipped: r.lessonsSkipped.length,
    errors: r.warnings,
    notes: [`${r.lessonsUnchanged} урока без промяна`, ...r.lessonsSkipped],
  };
  await record(user.id, "repository", null, sum);
  revalidatePath("/", "layout");
  return { ok: true, ...sum };
}
