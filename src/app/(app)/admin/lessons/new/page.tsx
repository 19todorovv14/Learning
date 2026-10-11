import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { lessonTemplate } from "@/lib/content/serialize";
import { LessonSourceEditor } from "@/components/admin/lesson-source-editor";
import { slugify } from "@/lib/utils";

export const metadata: Metadata = { title: "Нов урок" };

export default async function NewLessonPage({ searchParams }: PageProps<"/admin/lessons/new">) {
  await requireRolePage("TEACHER", "/admin/lessons/new");
  const sp = await searchParams;
  const courseSlug = typeof sp.course === "string" ? sp.course : "";
  const topicId = typeof sp.topic === "string" ? sp.topic : "";
  const courses = await db.curriculumVersion.findMany({ orderBy: [{ subject: { order: "asc" } }, { gradeId: "asc" }], select: { slug: true, title: true } });
  const course = courseSlug
    ? await db.curriculumVersion.findUnique({
        where: { slug: courseSlug },
        include: { sections: { orderBy: { order: "asc" }, include: { topics: { orderBy: { order: "asc" }, include: { _count: { select: { lessons: true } } } } } } },
      })
    : null;
  const topic = course?.sections.flatMap((s) => s.topics).find((t) => t.id === topicId);

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Нов урок</h1>
      <form method="get" className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <select name="course" defaultValue={courseSlug} className="input" aria-label="Курс">
          <option value="">— избери курс —</option>
          {courses.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.title}
            </option>
          ))}
        </select>
        <select name="topic" defaultValue={topicId} className="input" aria-label="Тема" disabled={!course}>
          <option value="">— избери тема —</option>
          {course?.sections.map((s) => (
            <optgroup key={s.id} label={s.title}>
              {s.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t._count.lessons ? ` (${t._count.lessons} урока)` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="btn-secondary">{course ? "Избери" : "Напред"}</button>
      </form>
      {course && topic && (
        <LessonSourceEditor initial={lessonTemplate(course.slug, topic.title, `${course.slug}-${slugify(topic.title)}`.slice(0, 90), topic.title)} isNew />
      )}
    </>
  );
}
