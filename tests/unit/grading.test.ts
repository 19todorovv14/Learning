import { describe, expect, it } from "vitest";
import { gradeQuestion, normalizeText, numbersEqual, parseNumericAnswer, seededShuffle, type QuestionForGrading } from "@/lib/quiz/grading";

const base: QuestionForGrading = {
  id: "q",
  type: "SINGLE_CHOICE",
  points: 1,
  options: [],
  acceptedAnswers: [],
  numericAnswer: null,
  numericTolerance: null,
  matchingPairs: null,
  rubric: [],
};

describe("parseNumericAnswer", () => {
  it.each([
    ["12", 12],
    ["-3.5", -3.5],
    ["2,5", 2.5],
    ["1 000", 1000],
    ["3/4", 0.75],
    ["-1 1/2", -1.5],
    ["50%", 0.5],
    ["2.5e3", 2500],
    ["−7", -7],
  ])("%s → %s", (input, expected) => {
    expect(parseNumericAnswer(input)).toBeCloseTo(expected as number, 10);
  });
  it.each(["", "abc", "1/0", "12abc", "1,2,3"])("отхвърля „%s“", (input) => {
    expect(parseNumericAnswer(input)).toBeNull();
  });
});

describe("normalizeText", () => {
  it("уеднаквява регистър, кавички, интервали и степени", () => {
    expect(normalizeText("  „Фотосинтеза“. ")).toBe("фотосинтеза");
    expect(normalizeText("3ab²")).toBe("3ab^2");
    expect(normalizeText("$3ab^2$")).toBe("3ab^2");
    expect(normalizeText("x  +  1")).toBe("x+1");
  });
});

describe("gradeQuestion", () => {
  const single = { ...base, options: [{ id: "a", isCorrect: false }, { id: "b", isCorrect: true }] };
  it("единичен избор", () => {
    expect(gradeQuestion(single, { optionIds: ["b"] }).isCorrect).toBe(true);
    expect(gradeQuestion(single, { optionIds: ["a"] }).isCorrect).toBe(false);
    expect(gradeQuestion(single, { optionIds: ["a", "b"] }).isCorrect).toBe(false);
    expect(gradeQuestion(single, undefined).pointsAwarded).toBe(0);
  });

  const multi: QuestionForGrading = {
    ...base,
    type: "MULTIPLE_CHOICE",
    points: 2,
    options: [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: true },
      { id: "c", isCorrect: false },
    ],
  };
  it("множествен избор дава частични точки", () => {
    expect(gradeQuestion(multi, { optionIds: ["a", "b"] })).toMatchObject({ isCorrect: true, pointsAwarded: 2 });
    expect(gradeQuestion(multi, { optionIds: ["a"] })).toMatchObject({ isCorrect: false, pointsAwarded: 1 });
    expect(gradeQuestion(multi, { optionIds: ["a", "c"] })).toMatchObject({ isCorrect: false, pointsAwarded: 0 });
  });
  it("строг режим (шофьорски изпит): всичко или нищо", () => {
    const strict = { ...multi, strict: true };
    expect(gradeQuestion(strict, { optionIds: ["a"] }).pointsAwarded).toBe(0);
    expect(gradeQuestion(strict, { optionIds: ["a", "b"] }).pointsAwarded).toBe(2);
  });

  it("числов отговор с толеранс и различни записи", () => {
    const q = { ...base, type: "NUMERIC" as const, numericAnswer: 0.75, numericTolerance: null };
    expect(gradeQuestion(q, { text: "3/4" }).isCorrect).toBe(true);
    expect(gradeQuestion(q, { text: "0,75" }).isCorrect).toBe(true);
    expect(gradeQuestion(q, { text: "0.7" }).isCorrect).toBe(false);
    const tol = { ...q, numericAnswer: 3.14, numericTolerance: 0.01 };
    expect(gradeQuestion(tol, { text: "3,145" }).isCorrect).toBe(true);
  });

  it("кратък текст и попълване приемат варианти", () => {
    const q = { ...base, type: "FILL_BLANK" as const, acceptedAnswers: ["3ab^2", "3ab²"] };
    expect(gradeQuestion(q, { text: " 3AB² " }).isCorrect).toBe(true);
    expect(gradeQuestion(q, { text: "3a^2b" }).isCorrect).toBe(false);
    const num = { ...base, type: "SHORT_TEXT" as const, acceptedAnswers: ["180"] };
    expect(gradeQuestion(num, { text: "180,0" }).isCorrect).toBe(true);
  });

  it("свързване: точки пропорционално на верните двойки", () => {
    const q = {
      ...base,
      type: "MATCHING" as const,
      points: 4,
      matchingPairs: [
        { left: "a", right: "1" },
        { left: "b", right: "2" },
      ],
    };
    expect(gradeQuestion(q, { matches: { "0": 0, "1": 1 } })).toMatchObject({ isCorrect: true, pointsAwarded: 4 });
    expect(gradeQuestion(q, { matches: { "0": 1, "1": 1 } })).toMatchObject({ isCorrect: false, pointsAwarded: 2 });
  });

  it("отворен въпрос: чака самооценка, после точки по критерии", () => {
    const q = { ...base, type: "OPEN" as const, points: 3, rubric: ["a", "b", "c"] };
    expect(gradeQuestion(q, { text: "отговор" }).gradedBy).toBe("PENDING");
    expect(gradeQuestion(q, { text: "отговор", rubricMet: [true, true, false] })).toMatchObject({ pointsAwarded: 2, gradedBy: "SELF_RUBRIC" });
  });
});

describe("помощни", () => {
  it("numbersEqual", () => {
    expect(numbersEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(numbersEqual(1, 1.1, 0.05)).toBe(false);
  });
  it("seededShuffle е детерминирано и запазва елементите", () => {
    const a = seededShuffle([1, 2, 3, 4, 5], "x");
    expect(seededShuffle([1, 2, 3, 4, 5], "x")).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
