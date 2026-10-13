import { describe, expect, it } from "vitest";

/** Картата на покритието отразява реалните данни — не обявява нищо за налично, ако не е внесено и проверено. */
const hasDb = !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hasDb)("покритие на образованието (от базата)", async () => {
  const { db } = await import("@/lib/db");
  const { computeCoverage, coverageMarkdown } = await import("@/lib/coverage");

  it("числата съвпадат с базата и статусите не преувеличават", async () => {
    const c = await computeCoverage(db);
    const verified = await db.lesson.count({ where: { status: { in: ["VERIFIED", "PUBLISHED"] } } });
    expect(c.lessons.verified).toBe(verified);
    expect(c.lessons.total).toBe(await db.lesson.count());
    expect(c.grades.map((g) => g.grade)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    // училища: без потвърдени записи статусът е „липсва“
    const schools = c.institutions.find((i) => i.name.startsWith("Училища"))!;
    const verifiedSchools = await db.school.count({ where: { verified: true } });
    expect(schools.status).toBe(verifiedSchools ? "PARTIAL" : "MISSING");
    // кандидатстудентски изпити: без записи — „липсва“
    const admissions = c.institutions.find((i) => i.name.startsWith("Кандидатстудентски"))!;
    expect(admissions.status).toBe((await db.admissionInfo.count({ where: { verificationStatus: "CURRENT" } })) ? "PARTIAL" : "MISSING");
    // програма без нито един урок никога не е „потвърдена“
    for (const st of c.stages) for (const s of st.subjects) if (s.note.includes("теми с урок: 0/")) expect(s.status).not.toBe("CONFIRMED");
    // НВО IV клас няма курс в базата
    expect(c.exams.find((e) => e.name.startsWith("НВО IV клас — математика"))?.status).toBe("MISSING");

    const md = coverageMarkdown(c);
    expect(md).toContain("ЧАКА СВЕРКА");
    expect(md).toContain(`проверени от редактор: ${verified}`);
  });
});
