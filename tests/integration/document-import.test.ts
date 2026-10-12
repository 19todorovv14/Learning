import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const hasDb = !!process.env.DATABASE_URL_TEST;
const fixture = (name: string) => readFileSync(join(__dirname, "..", "fixtures", name));

describe.skipIf(!hasDb)("импорт на документи като чернова (PDF, DOCX)", async () => {
  const { db } = await import("@/lib/db");
  const { importDocumentAsDraft } = await import("@/lib/admin/import");
  const created: string[] = [];
  const editor = await db.user.create({ data: { email: `editor-${Date.now()}@example.bg`, passwordHash: "x", displayName: "Редактор", role: "EDITOR" } });
  afterAll(async () => {
    await db.lesson.deleteMany({ where: { id: { in: created } } });
    await db.user.delete({ where: { id: editor.id } });
  });

  for (const [file, expected] of [
    ["sample.docx", "правопропорционална на напрежението"],
    ["sample.pdf", "образуват глюкоза"],
  ] as const) {
    it(`извлича текста от ${file} и създава чернова`, async () => {
      const f = new File([fixture(file)], file);
      const res = await importDocumentAsDraft(f, "fizika-7", "Скорост", editor.id);
      expect(res.errors).toEqual([]);
      expect(res.lessonId).toBeTruthy();
      created.push(res.lessonId!);
      const lesson = await db.lesson.findUniqueOrThrow({ where: { id: res.lessonId! }, include: { sections: true } });
      expect(lesson.status).toBe("DRAFT");
      expect(lesson.sections.map((s) => s.body).join("\n")).toContain(expected);
    });
  }

  it("отказва неподдържан формат", async () => {
    const res = await importDocumentAsDraft(new File([Buffer.from("MZ")], "virus.exe"), "fizika-7", "Скорост", editor.id);
    expect(res.errors[0]).toMatch(/Поддържани формати/);
  });
});
