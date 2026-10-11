import { describe, expect, it } from "vitest";

const hasDb = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hasDb)("редакция на урок (интеграционен тест с база)", async () => {
  const { db } = await import("@/lib/db");
  const { loadLessonSource } = await import("@/lib/admin/lessons");
  const { parseLessonFile } = await import("@/lib/content/parse-lesson");
  const { saveParsedLesson } = await import("@/lib/content/save-lesson");

  it("записът от редактора създава нова версия и запазва идентификаторите на въпросите и картите", async () => {
    const lesson = await db.lesson.findFirstOrThrow({ where: { terms: { some: {} }, questions: { some: {} } } });
    const before = await db.lesson.findUniqueOrThrow({
      where: { id: lesson.id },
      include: { terms: { include: { flashcards: true } }, questions: { where: { externalKey: { not: null } }, include: { options: true } } },
    });
    const src = await loadLessonSource(lesson.id);
    const edited = src!.md.replace(/^title: .*$/m, 'title: "Редактирано заглавие"');
    const parsed = parseLessonFile("test", edited, lesson.slug);
    const result = await saveParsedLesson(db, parsed, edited, { source: "admin", changeNote: "тест" });
    expect(result).toBe("updated");
    const after = await db.lesson.findUniqueOrThrow({
      where: { id: lesson.id },
      include: { terms: { include: { flashcards: true } }, questions: { where: { externalKey: { not: null } }, include: { options: true } } },
    });
    expect(after.title).toBe("Редактирано заглавие");
    expect(after.version).toBe(before.version + 1);
    expect(after.editedInAdminAt).not.toBeNull();
    expect(after.questions.map((q) => q.id).sort()).toEqual(before.questions.map((q) => q.id).sort());
    expect(after.terms.flatMap((t) => t.flashcards.map((f) => f.id)).sort()).toEqual(before.terms.flatMap((t) => t.flashcards.map((f) => f.id)).sort());
    const rev = await db.lessonRevision.findFirst({ where: { lessonId: lesson.id, version: after.version } });
    expect(rev?.changeNote).toBe("тест");

    // връщаме оригинала
    const original = parseLessonFile("test", src!.md, lesson.slug);
    await saveParsedLesson(db, original, src!.md, { source: "admin", changeNote: "връщане" });
  });
});
