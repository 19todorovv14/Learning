"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { processPipeline } from "@/lib/pipeline/stages";
import {
  approveItem,
  assignTopic,
  createItem,
  createManualDraft,
  enqueueMissingTopics,
  PipelineActionError,
  recheckItem,
  rediscoverItem,
  rejectItem,
  retryItem,
} from "@/lib/pipeline/service";

/** Действията изискват роля „редактор“ — проверява се на сървъра при всяко извикване. */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const itemUrl = (id: string, qs: string) => `/admin/pipeline/${id}?${qs}`;
const err = (e: unknown) => `error=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 300) : "Грешка")}`;

async function guarded(id: string, fn: () => Promise<string>): Promise<never> {
  let qs: string;
  try {
    qs = await fn();
  } catch (e) {
    if (!(e instanceof PipelineActionError)) throw e;
    qs = err(e);
  }
  revalidatePath("/admin/pipeline");
  redirect(itemUrl(id, qs));
}

export async function createPipelineItemAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const topicId = str(fd, "topicId") || null;
  const query = str(fd, "query") || null;
  let target: string;
  try {
    const { item, created } = await createItem(db, { topicId, query, createdById: user.id });
    if (created) await audit(user.id, "pipeline.create", "PipelineItem", item.id, { topicId, query });
    target = itemUrl(item.id, created ? "created=1" : "exists=1");
  } catch (e) {
    if (!(e instanceof PipelineActionError)) throw e;
    target = `/admin/pipeline?${err(e)}`;
  }
  revalidatePath("/admin/pipeline");
  redirect(target);
}

export async function enqueueMissingTopicsAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const cvId = str(fd, "curriculumVersionId");
  const limit = Math.min(Math.max(Number(str(fd, "limit")) || 5, 1), 50);
  const created = await enqueueMissingTopics(db, cvId, limit, user.id);
  await audit(user.id, "pipeline.enqueue_missing", "CurriculumVersion", cvId, { created });
  revalidatePath("/admin/pipeline");
  redirect(`/admin/pipeline?added=${created}`);
}

export async function processPipelineNowAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const back = str(fd, "back");
  const s = await processPipeline(db, { workerId: `admin-${user.id}`, maxJobs: 10, deadlineMs: 45_000 });
  await audit(user.id, "pipeline.process", "PipelineJob", null, s);
  revalidatePath("/admin/pipeline");
  const qs = `processed=${s.processed}&ok=${s.succeeded}&retry=${s.retried}&failed=${s.failed}&blocked=${s.blocked}`;
  redirect(back.startsWith("/admin/pipeline") ? `${back.split("?")[0]}?${qs}` : `/admin/pipeline?${qs}`);
}

export async function retryPipelineItemAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = str(fd, "id");
  return guarded(id, async () => {
    const kind = await retryItem(db, id, user.id);
    await audit(user.id, "pipeline.retry", "PipelineItem", id, { kind });
    return "retried=1";
  });
}

export async function rediscoverPipelineItemAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = str(fd, "id");
  return guarded(id, async () => {
    await rediscoverItem(db, id);
    await audit(user.id, "pipeline.rediscover", "PipelineItem", id);
    return "retried=1";
  });
}

export async function recheckPipelineItemAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = str(fd, "id");
  return guarded(id, async () => {
    await recheckItem(db, id);
    await audit(user.id, "pipeline.recheck", "PipelineItem", id);
    return "checked=1";
  });
}

export async function assignTopicAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = str(fd, "id");
  const topicId = str(fd, "topicId");
  return guarded(id, async () => {
    if (!topicId) throw new PipelineActionError("Изберете тема");
    await assignTopic(db, id, topicId);
    await audit(user.id, "pipeline.assign_topic", "PipelineItem", id, { topicId });
    return "assigned=1";
  });
}

export async function manualDraftAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = str(fd, "id");
  let target: string;
  try {
    const lessonId = await createManualDraft(db, id, user.id);
    await audit(user.id, "pipeline.manual_draft", "PipelineItem", id, { lessonId });
    target = `/admin/lessons/${lessonId}?pipeline=${id}`;
  } catch (e) {
    if (!(e instanceof PipelineActionError)) throw e;
    target = itemUrl(id, err(e));
  }
  revalidatePath("/admin/pipeline");
  redirect(target);
}

export async function approvePipelineItemAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = str(fd, "id");
  const note = str(fd, "note").slice(0, 1000) || null;
  return guarded(id, async () => {
    await approveItem(db, id, user.id, note);
    await audit(user.id, "pipeline.approve", "PipelineItem", id);
    return "approved=1";
  });
}

export async function rejectPipelineItemAction(fd: FormData) {
  const user = await requireRole("EDITOR");
  const id = str(fd, "id");
  const note = str(fd, "note").slice(0, 1000);
  return guarded(id, async () => {
    await rejectItem(db, id, user.id, note);
    await audit(user.id, "pipeline.reject", "PipelineItem", id);
    return "rejected=1";
  });
}
